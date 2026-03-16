# 分镜生成模式切换设计：基于首尾帧 vs 基于参考图

**日期：** 2026-03-16
**状态：** 已审批

---

## 概述

在分镜（Shot）模块新增生成模式切换功能。现有的「基于首尾帧」逻辑原样保留并迁移至对应 Tab，同时新增「基于参考图」模式：跳过首帧/末帧生成环节，直接用角色参考图 + 剧情描述文生视频。

---

## 需求

- 分镜页顶部显示两个 Tab：**「基于首尾帧」** 和 **「基于参考图」**
- 切换为项目级，整个项目统一使用同一模式
- 模式持久化存储到数据库，刷新页面不丢失
- 「基于首尾帧」Tab：现有所有逻辑不变（帧生成、连续性链、批量操作）
- 「基于参考图」Tab：全新实现，跳过帧生成，直接文生视频，自动收集所有有参考图的角色

---

## 数据层

### DB 迁移

新建 `drizzle/0002_add_generation_mode.sql`：

```sql
ALTER TABLE projects ADD COLUMN generation_mode TEXT NOT NULL DEFAULT 'keyframe';
```

取值：`'keyframe'`（默认，首尾帧模式）| `'reference'`（参考图模式）

在 `drizzle/meta/_journal.json` 添加条目 `{ "idx": 2, "when": ..., "tag": "0002_add_generation_mode" }`。

### Schema 更新

`src/lib/db/schema.ts` 的 `projects` 表添加：

```ts
generationMode: text('generation_mode').notNull().default('keyframe'),
```

### API 更新

`PATCH /api/projects/[id]` 已支持字段更新，直接将 `generationMode` 加入可更新字段列表，无需新路由。

---

## API & Pipeline 层

### 新增 generate actions

| Action | 说明 |
|---|---|
| `single_reference_video` | 参考图模式：单镜头文生视频 |
| `batch_reference_video` | 参考图模式：批量文生视频（串行） |

### `single_reference_video` 处理流程

payload 需包含：`{ shotId: string }`（与现有 `single_video_generate` 一致）

```
1. 验证项目归属（userId）
2. 根据 payload.shotId 查询镜头
3. 查询项目下所有有 referenceImage 的角色 → charRefImages[]（角色是项目级的）
4. 若 charRefImages 为空 → 返回 400（提示先生成角色参考图）
5. 用 shot.prompt + 角色描述拼接视频 prompt
6. 调用 videoProvider.generateVideo({
     prompt,
     charRefImages,   // 以 base64 编码传入（与现有 firstFrame 处理方式一致）
     duration,
     ratio,
     // 不传 firstFrame / lastFrame
   })
7. 下载视频 → 存 shots.videoUrl
8. 更新 shots.status = 'completed'
```

### `batch_reference_video` 处理流程

与现有 `batch_video_generate` 结构一致，串行处理每个镜头，每个镜头调用 `single_reference_video` 逻辑。

### AI Provider 层

扩展 `KlingVideoProvider`，在 `generateVideo()` 中增加分支判断：

- 有 `firstFrame` → 调用 `/v1/videos/image2video`（现有逻辑不变）
- 无 `firstFrame`，有 `charRefImages` → 调用 `/v1/videos/text2video`，将 `charRefImages`（base64 编码）作为 `reference_image` 参数传入

**轮询端点：** `image2video` 和 `text2video` 使用各自对应的轮询端点：
- `image2video` 任务 → 轮询 `/v1/videos/image2video/{taskId}`（现有）
- `text2video` 任务 → 轮询 `/v1/videos/text2video/{taskId}`（新增）

`pollForResult()` 需接收端点前缀作为参数（或在提交任务时记录类型）。

**Fallback：** 若 Kling text2video 不支持 `reference_image` 参数（API 返回 400/422），捕获错误后退化为只传 `prompt` 重试一次。

**`VideoGenerateParams` 类型变更：**

```ts
// firstFrame 和 lastFrame 改为可选，参考图模式不传
firstFrame?: string
lastFrame?: string
charRefImages?: string[]   // 角色参考图本地路径列表，provider 内部转 base64
```

**现有 keyframe 模式的保护：** `handleSingleVideoGenerate` 和 `handleBatchVideoGenerate` 中现有的帧存在性检查（`if (!shot.firstFrame || !shot.lastFrame)`）**保持不变**，确保首尾帧模式调用路径的安全性不受影响。`batch_video_generate` action 的逻辑（含帧过滤）**完全不变**；参考图模式走独立的 `batch_reference_video` action。

---

## UI 层

### 新增组件

**`src/components/editor/generation-mode-tab.tsx`**

- 项目级 Tab 切换组件，放在分镜列表最顶部
- 两个 Tab：「🎞️ 基于首尾帧」 / 「🖼️ 基于参考图」
- 点击时调用 `PATCH /api/projects/[id]` 更新 `generationMode`
- 通过 `project-store` 同步到全局状态

### 修改现有组件

**`src/app/[locale]/projects/[id]/storyboard/page.tsx`**（主分镜页，非 shot-panel）

- 渲染 `GenerationModeTab` 组件（放在分镜列表顶部）
- 参考图模式下，Tab 下方显示角色参考图提示条：
  - 有参考图角色 → `「🖼️ 参考角色：小明、小红…（N 个）」`
  - 无参考图角色 → `「⚠️ 无可用参考图，请先为角色生成参考图」` + 跳转链接
- 批量操作按钮区：
  - 首尾帧模式：「批量生成帧」 + 「批量生成视频」
  - 参考图模式：只显示「批量生成视频」（调用 `batch_reference_video`）
- **步骤指示器（step indicator）模式感知：**
  - 首尾帧模式：现有逻辑（step2 = shotsWithFrames === totalShots）
  - 参考图模式：step2（帧生成）跳过，直接以 shotsWithVideos === totalShots 判断 step3 完成

**`ShotCard` 组件**

接收新 prop `generationMode: 'keyframe' | 'reference'`：

| UI 元素 | 首尾帧模式 | 参考图模式 |
|---|---|---|
| 首帧/末帧缩略图 | 显示 | 隐藏 |
| 「生成帧」按钮 | 显示 | 隐藏 |
| 「生成视频」按钮 | 显示（需有帧才启用） | 显示（始终可点击） |
| 状态 badge 颜色 | 蓝色系 | 紫色系 |

### 数据共用

两种模式共用 `shots.videoUrl` 字段，切换模式时已有数据保留（不删除），新生成时直接覆写。

---

## 边界情况

| 情况 | 处理 |
|---|---|
| 参考图模式但无角色有参考图 | 「生成视频」按钮 disabled，提示栏显示警告 + 跳转引导 |
| 切换模式时已有首尾帧或视频数据 | 数据保留，不删除 |
| Kling text2video 不支持 reference_image | fallback 到纯文生视频（只传 prompt） |
| 批量参考图视频生成 | 串行执行，与现有 batch 一致 |

---

## 文件改动清单

| 文件 | 操作 |
|---|---|
| `drizzle/0002_add_generation_mode.sql` | 新建 |
| `drizzle/meta/_journal.json` | 添加迁移条目（idx: 2） |
| `src/lib/db/schema.ts` | 添加 `generationMode` 字段 |
| `src/app/api/projects/[id]/route.ts` | PATCH 支持 `generationMode`，补全 TypeScript 类型定义 |
| `src/app/api/projects/[id]/generate/route.ts` | 添加 `single_reference_video`、`batch_reference_video` handlers |
| `src/lib/ai/types.ts` | `VideoGenerateParams` 添加 `charRefImages?`，`firstFrame`/`lastFrame` 改为可选 |
| `src/lib/ai/providers/kling-video.ts` | 添加 text2video 分支 + 轮询端点参数化 |
| `src/lib/pipeline/reference-video.ts` | 新建，参考图模式 pipeline handler |
| `src/stores/project-store.ts` | `Project` 接口添加 `generationMode` 字段 |
| `src/components/editor/generation-mode-tab.tsx` | 新建 |
| `src/components/editor/shot-card.tsx` | 接收并响应 `generationMode` prop |
| `src/app/[locale]/projects/[id]/storyboard/page.tsx` | 渲染 GenerationModeTab、条件渲染批量按钮、步骤指示器模式感知 |
| `messages/{zh,en,ja,ko}.json` | 添加 Tab 标签、提示文案的 i18n key |
