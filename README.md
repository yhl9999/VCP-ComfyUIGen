# ComfyUI 插件用户手册

## 概述

ComfyUIGen 是一个强大的VCPChat插件，用于集成ComfyUI图像生成功能。插件采用**前后端完全解耦架构**，支持多种部署方式和灵活的配置管理。

### 支持的部署方式
- **本地部署**: `http://localhost:8188` - 推荐新手使用
- **VSCode端口转发**: 通过端口映射访问远程ComfyUI
- **云服务器**: 自定义URL和API密钥
- **Docker容器**: 容器化部署方案

## 架构特点

### 🔄 前后端完全解耦设计

**ComfyUIGen采用现代化的解耦架构：**

```
┌─────────────────┐    JSON    ┌─────────────────┐    HTTP    ┌─────────────────┐
│   VCPChat UI    │◄─────────►│  ComfyUIGen.js  │◄─────────►│   ComfyUI服务器  │
│     前端界面     │   IPC通信   │    独立后端      │   API调用   │    图像生成      │
└─────────────────┘            └─────────────────┘            └─────────────────┘
```

**核心优势：**
- ✅ **后端独立运行** - ComfyUIGen.js可脱离前端独立工作
- ✅ **标准化接口** - 通过JSON输入输出进行通信
- ✅ **灵活配置** - 支持多层次配置系统
- ✅ **无缝集成** - 不需要修改ComfyUI本身

## 配置系统说明

### 📋 配置优先级（从高到低）

1. **Agent/用户输入参数** (最高优先级)
   - 实时传入的prompt、negative_prompt等
   - 临时覆盖所有其他配置

2. **comfyui-settings.json** (用户配置)
   - 通过VCPChat前端界面配置
   - 存储用户的个性化设置

3. **config.env** (环境配置)
   - 服务器连接和部署配置
   - 适合系统管理员设置

4. **系统默认值** (最低优先级)
   - 代码中的兜底配置
   - 确保基础功能可用

### 🚀 无前端配置方案（适合开发者/服务器部署）

**如果没有VCPChat前端，可通过以下方式配置：**

#### 方式1：环境变量配置
```bash
# 设置ComfyUI连接
export COMFYUI_BASE_URL="http://localhost:8188"
export COMFYUI_API_KEY="your_api_key"  # 可选

# 设置图片保存路径（必需）
export PROJECT_BASE_PATH="/path/to/your/project"
export SERVER_PORT="6007"
export IMAGESERVER_IMAGE_KEY="your_image_key"
export VarHttpUrl="http://localhost"

# 启用调试模式
export DEBUG_MODE="true"
```

#### 方式2：创建comfyui-settings.json
```json
{
  "serverUrl": "http://127.0.0.1:8188",
  "apiKey": "",
  "MODEL_NAME": "matureRitual_v1211oil.safetensors",
  "lora_name": "your_lora.safetensors",
  "workflow": "text2img_basic",
  "seed": 156680208700286,
  "steps": 20,
  "cfg_scale": 7,
  "sampler_name": "euler",
  "scheduler": "normal",
  "width": 1024,
  "height": 1024,
  "negative_prompt": "lowres, bad anatomy, bad hands, text, error"
}
```

#### 方式3：命令行直接调用
```bash
# 直接测试后端（独立运行）
echo '{"prompt":"a beautiful sunset over mountains"}' | node ComfyUIGen.js

# 带完整参数的调用
echo '{
  "prompt": "a cute cat sitting on a windowsill",
  "width": 768,
  "height": 512,
  "steps": 25
}' | node ComfyUIGen.js
```

### 🎨 有前端配置方案（推荐普通用户）

**通过VCPChat图形界面进行配置：**

#### 1. 基础设置
1. 打开VCPChat → 设置 → 全局设置
2. 找到"ComfyUI图像生成"区域
3. 启用"启用ComfyUI图像生成"开关
4. 设置"ComfyUI服务器URL"（默认：http://localhost:8188）
5. 可选设置"ComfyUI API Key"

#### 2. 详细参数配置
1. 点击"参数配置"按钮打开配置界面
2. **测试连接**：点击"测试连接"按钮确保服务器可达
3. **加载模型**：点击"加载模型"获取可用模型列表
4. **配置参数**：
   - 选择模型文件（从下拉列表选择）
   - 选择LoRA模型（可选，点击"加载LoRA"选择）
   - 选择工作流模板
   - 调整图像尺寸（宽度×高度）
   - 设置采样参数（步数、CFG强度、采样器等）
   - 输入负面提示词
5. **保存配置**：点击"保存配置"应用设置

## 工作流管理

### 📁 文件结构
```
ComfyUIGen/
├── ComfyUIGen.js              # 主后端程序
├── comfyui-settings.json      # 用户配置文件
├── config.env                 # 环境配置文件
├── placeholder-processor.js   # 占位符处理器
├── workflows/                 # 工作流模板目录
│   ├── text2img_basic.json   # 基础文生图工作流
│   ├── text2img_test.json    # 测试工作流
│   └── [自定义工作流...]      # 用户添加的工作流
└── README.md                  # 本文档
```

### 🔄 工作流替换机制

**插件使用占位符系统替换工作流中的参数：**

#### 支持的占位符
```json
{
  "%prompt%": "用户输入的正面提示词",
  "%negative_prompt%": "负面提示词", 
  "%width%": "图像宽度",
  "%height%": "图像高度",
  "%steps%": "采样步数",
  "%cfg_scale%": "CFG引导强度",
  "%seed%": "随机种子",
  "%sampler_name%": "采样器名称",
  "%scheduler%": "调度器类型",
  "%MODEL_NAME%": "模型文件名",
  "%lora_name%": "LoRA模型名",
  "%denoise%": "去噪强度",
  "%batch_size%": "批量大小"
}
```

#### 工作流模板示例
```json
{
  "6": {
    "inputs": {
      "text": "%prompt%",
      "clip": ["10", 1]
    },
    "class_type": "CLIPTextEncode"
  },
  "4": {
    "inputs": {
      "ckpt_name": "%MODEL_NAME%"
    },
    "class_type": "CheckpointLoaderSimple"
  },
  "10": {
    "inputs": {
      "lora_name": "%lora_name%",
      "strength_model": 1.0,
      "strength_clip": 1.0
    },
    "class_type": "LoraLoader"
  }
}
```

### ➕ 添加自定义工作流

#### 方法1：通过ComfyUI界面
1. 在ComfyUI中设计你的工作流
2. 点击"Save (API Format)"导出JSON文件
3. 将关键参数替换为占位符（如 `%prompt%`, `%MODEL_NAME%`）
4. 将文件保存到 `workflows/` 目录
5. 重启VCPChat或刷新工作流列表

#### 方法2：手动创建
1. 复制现有的 `text2img_basic.json`
2. 修改节点配置和连接关系
3. 确保包含必要的占位符
4. 保存为新的工作流文件

### 🚀 一键替换工作流功能（计划中）

**即将推出的高级功能：**
- 🔄 **工作流热更新** - 无需重启即可切换工作流
- 📋 **工作流管理界面** - 图形化管理和预览工作流
- 🔍 **参数兼容性检查** - 自动验证工作流参数完整性
- 📥 **一键导入导出** - 支持工作流的批量管理
- 🎯 **智能参数映射** - 自动识别和映射常用参数

## 插件注册和部署

### 📦 文件放置位置

**标准VCP插件目录结构：**
```
d:\vcp\VCPToolBox\Plugin\ComfyUIGen\
├── ComfyUIGen.js              # ← 主程序文件
├── plugin-manifest.json       # ← 插件清单（必需）
├── comfyui-settings.json      # ← 用户配置
├── config.env                 # ← 环境配置
├── placeholder-processor.js   # ← 占位符处理器
├── workflows\                 # ← 工作流目录
├── node_modules\              # ← 依赖包（自动生成）
├── package.json               # ← Node.js包配置
└── README.md                  # ← 本文档
```

### 🔧 插件注册说明

#### 1. plugin-manifest.json配置
```json
{
  "name": "ComfyUIGen",
  "version": "0.2.0",
  "description": "高级ComfyUI图像生成插件，支持多工作流、LoRA模型和前后端解耦架构",
  "author": "VCP Team",
  "main": "ComfyUIGen.js",
  "type": "image_generation",
  "capabilities": [
    "text_to_image", 
    "workflow_customization",
    "lora_support",
    "model_management"
  ],
  "tool_description": "专业的ComfyUI集成工具，Agent提供创意提示词，用户负责技术参数配置，系统自动整合生成高质量图像。支持多工作流、LoRA模型和实时参数调节。",
  "parameters": {
    "required": ["prompt"],
    "optional": ["negative_prompt", "width", "height", "steps", "cfg_scale", "seed", "workflow", "sampler_name", "scheduler"]
  }
}
```

#### 2. 系统自动注册
- VCP系统会自动扫描 `Plugin/` 目录
- 识别包含 `plugin-manifest.json` 的文件夹
- 根据清单文件注册插件到工具系统
- Agent可通过工具名调用插件

#### 3. 手动注册验证
```bash
# 检查插件是否正确注册
# 在VCP日志中查找以下信息：
[Plugin Manager] Loaded plugin: ComfyUIGen v0.2.0
[Tool Registry] Registered tool: ComfyUIGen
```

### 🔨 依赖安装

#### 自动安装（推荐）
```bash
cd d:\vcp\VCPToolBox\Plugin\ComfyUIGen
npm install
```

#### 手动安装核心依赖
```bash
npm install axios uuid
```

#### 验证依赖
```bash
# 检查关键依赖是否安装
node -e "console.log(require('axios').VERSION || 'axios installed')"
node -e "console.log(require('uuid').v4() ? 'uuid working' : 'uuid error')"
```

## VCPChat 前端集成（可选）

**注意：** 前端集成是可选的。即使没有前端界面，ComfyUIGen后端依然可以完全独立工作。

### 前端集成优势
- ✅ **图形化配置** - 可视化参数设置界面
- ✅ **实时连接测试** - 一键检测ComfyUI服务器状态
- ✅ **模型浏览器** - 自动获取和选择可用模型
- ✅ **LoRA管理** - 图形化LoRA模型选择
- ✅ **工作流切换** - 下拉菜单选择不同工作流

### 前端集成详情

#### 1. 全局设置集成
**文件修改**: `D:\vcp\VCPChat\main.html` (行412-436)

在全局设置模态框中添加了：
- **ComfyUI服务启用开关**: 控制是否启用ComfyUI图像生成
- **ComfyUI服务器URL配置**: 默认 `http://localhost:8188`
- **ComfyUI API Key配置**: 可选的API认证密钥
- **参数配置按钮**: 打开详细参数配置界面

#### 2. ComfyUI参数配置界面
**文件修改**: `D:\vcp\VCPChat\main.html` (行540-631)

新增独立的配置模态框，包含：

**基础参数**:
- 随机种子 (Seed): 控制生成结果的随机性，默认 156680208700286
- 采样步数 (Steps): 影响图像质量，默认 20，范围 1-150
- CFG引导强度: 控制模型遵循提示词程度，默认 7，范围 0.1-30
- 采样器选择: Euler, Euler Ancestral, DPM++ 2M 等
- 调度器选择: Normal, Karras, Exponential 等

**图像尺寸**:
- 宽度/高度: 默认 1024x1024，范围 64-4096，步长 64

**模型和提示词**:
- 模型名称: 默认 `v1-5-pruned-emaonly.ckpt`，支持从服务器加载
- 负面提示词: 多行文本输入，默认包含常见负面词汇

**功能按钮**:
- 随机种子生成
- 连接测试
- 模型列表加载
- 配置保存

#### 3. 前端逻辑实现
**文件修改**: `D:\vcp\VCPChat\modules\settingsManager.js` (行52-56, 362-488, 532-629)

新增功能函数：
- `openComfyUIConfig()`: 打开配置界面并加载当前设置
- `populateComfyUIConfigForm()`: 填充表单数据
- `saveComfyUIConfig()`: 保存配置到后端
- `generateRandomSeed()`: 生成随机种子
- `testComfyUIConnection()`: 测试服务器连接
- `loadComfyUIModels()`: 从服务器加载模型列表

#### 4. IPC接口扩展
**文件修改**: `D:\vcp\VCPChat\preload.js` (行244-248)

新增electronAPI接口：
- `getSettings()`: 获取设置（复用现有接口）
- `saveComfyUIConfig(config)`: 保存ComfyUI配置
- `testComfyUIConnection()`: 测试连接
- `getComfyUIModels()`: 获取模型列表

#### 5. 后端处理器实现
**文件新增**: `D:\vcp\VCPChat\modules\ipc\comfyuiHandlers.js`

实现了完整的后端处理逻辑：
- ComfyUI服务器连接管理
- 配置数据持久化存储
- 模型列表获取和缓存
- 错误处理和状态反馈

**默认配置**:
```javascript
const defaultComfyUIConfig = {
    seed: 156680208700286,
    steps: 20,
    cfg_scale: 7,
    sampler_name: 'euler',
    scheduler: 'normal',
    width: 1024,
    height: 1024,
    MODEL_NAME: 'v1-5-pruned-emaonly.ckpt',
    negative_prompt: 'lowres, bad anatomy, bad hands, text, error...'
};
```

#### 6. 主程序集成
**文件修改**: `D:\vcp\VCPChat\main.js` (行31, 213-222)

- 导入ComfyUI处理器模块
- 在应用初始化时注册IPC处理器
- 修复了IPC handlers初始化参数传递问题

### 占位符处理系统

**现有文件**: `D:\vcp\VCPToolBox\Plugin\ComfyUIGen\placeholder-processor.js`

该系统已完整实现：
- 占位符提取和分类（Agent生成 vs 用户配置）
- 参数验证框架
- 多API格式转换支持
- 前端配置模板生成

### 工作流程设计

1. **前端参数配置**: 用户通过VCPChat界面配置所有ComfyUI参数
2. **Agent提示词生成**: Agent通过系统提示词生成图像描述prompt
3. **参数整合**: 后端结合前端配置和Agent生成的prompt
4. **占位符替换**: 使用placeholder-processor.js替换工作流中的占位符
5. **ComfyUI调用**: 发送完整工作流给ComfyUI服务器生成图像

## 系统设计和工作流程

### 🎯 **优化的Agent-ComfyUI协作模式**

#### 工作原理
1. **Agent职责**: 专注于创意，根据用户需求和上下文生成高质量的正面提示词
2. **用户配置**: 通过VCPChat前端设置所有技术参数（模型、LoRA、尺寸、采样器等）
3. **后端整合**: 自动合并Agent的创意提示词和用户的技术配置，生成最终图像

#### 调用方式
Agent只需提供**prompt**（正面提示词），所有技术参数由用户预先配置：

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」ComfyUIGen「末」,
prompt:「始」a majestic dragon soaring through cloudy skies, highly detailed fantasy art, epic scene「末」
<<<[END_TOOL_REQUEST]>>>
```

#### 配置优先级
1. **Agent输入参数** (最高优先级) - prompt、negative_prompt等
2. **用户前端配置** (comfyui-settings.json) - 模型、LoRA、尺寸、采样器等
3. **环境配置** (config.env) - 服务器地址、API密钥等
4. **系统默认值** (最低优先级) - 基础兜底参数

### ✅ **前后端配置链路集成 (已完成)**

#### 集成成果 
经过完整的系统重构，现已实现了以下功能：

**前端界面优化**
- ✅ 将测试连接按钮移至ComfyUI服务器地址配置后，改善用户交互流程
- ✅ 添加工作流选择下拉菜单到ComfyUIConfig模态框
- ✅ 从workflows目录动态加载可用工作流列表
- ✅ 增强用户配置保存到comfyui-settings.json的字段支持

**后端配置集成**
- ✅ 修改ComfyUIGen.js读取comfyui-settings.json配置文件
- ✅ 实现config.env + comfyui-settings.json的优先级配置机制
- ✅ 集成placeholder-processor.js到主生成流程
- ✅ 建立统一的参数验证和转换系统

**LoRA支持实现**
- ✅ 扩展默认工作流包含LoRA加载节点
- ✅ 修改updateWorkflowWithParams函数支持LoRA参数
- ✅ 实现LoRA模型文件路径的正确应用
- ✅ 添加LoRA强度参数控制

**工作流管理系统**
- ✅ 实现动态工作流模板加载
- ✅ 支持用户自定义工作流上传
- ✅ 工作流参数验证和占位符处理
- ✅ 工作流兼容性检查机制

#### 预期成果（全部实现）
- ✅ 前端VCPChat配置完全生效到后端生成过程  
- ✅ 用户选择的模型、LoRA、参数正确应用
- ✅ 支持多种工作流模板选择
- ✅ 统一的参数验证和错误处理
- ✅ 完整的配置优先级：用户设置 > config.env > 系统默认

## 待实现功能和扩展计划

### 🔧 其他计划功能

#### 工作流扩展支持
- [ ] img2img工作流模板
- [ ] inpainting工作流模板  
- [ ] controlNet工作流支持
- [ ] 批量生成模式

#### 高级参数支持
- [ ] LoRA强度参数调节
- [ ] 多LoRA模型混合
- [ ] 高级采样器参数
- [ ] 自定义VAE支持

#### 性能和稳定性
- [ ] 生成任务队列管理
- [ ] 断点续传支持
- [ ] 网络请求重试机制
- [ ] 内存使用优化

## 安装步骤

1. **创建配置文件**:
   ```bash
   cp config.env.example config.env
   ```

2. **编辑配置**:
   ```bash
   # 修改 config.env 中的 ComfyUI 地址
   COMFYUI_BASE_URL=http://localhost:8188
   ```

3. **安装依赖**:
   ```bash
   npm install axios uuid
   ```

4. **确保ComfyUI运行**:
   - 启动ComfyUI并确保API可访问
   - 默认端口为8188

5. **前端配置**:
   - 在VCPChat中打开全局设置
   - 启用ComfyUI图像生成
   - 配置服务器地址和参数
   - 测试连接确保正常

## 使用方法

### 🔧 前端配置（一次性设置）
1. 打开VCPChat全局设置
2. 启用"ComfyUI图像生成"开关
3. 配置服务器URL（默认 http://localhost:8188）
4. 点击"参数配置"进行详细设置：
   - 选择模型文件
   - 选择LoRA模型（可选）
   - 选择工作流模板
   - 调整采样参数、图像尺寸等
5. 测试连接确保服务正常

### 🤖 Agent调用（简化方式）

#### 基础调用（推荐）
Agent只需生成创意性的正面提示词：

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」ComfyUIGen「末」,
prompt:「始」a serene landscape with cherry blossoms, soft morning light, photorealistic, highly detailed「末」
<<<[END_TOOL_REQUEST]>>>
```

#### 带负面提示词的调用
```
<<<[TOOL_REQUEST]>>>
tool_name:「始」ComfyUIGen「末」,
prompt:「始」a majestic castle on a hilltop, fantasy art style, golden hour lighting「末」,
negative_prompt:「始」blurry, low quality, distorted architecture「末」
<<<[END_TOOL_REQUEST]>>>
```

#### 指定工作流的调用
```
<<<[TOOL_REQUEST]>>>
tool_name:「始」ComfyUIGen「末」,
prompt:「始」portrait of a wise wizard, detailed facial features, magical atmosphere「末」,
workflow:「始」text2img_advanced「末」
<<<[END_TOOL_REQUEST]>>>
```

### 🎯 工作分工说明

| 角色 | 负责内容 | 示例 |
|------|----------|------|
| **Agent** | 创意性描述、艺术风格、场景构思 | "一个神秘的森林场景，阳光透过树叶洒下" |
| **用户配置** | 技术参数、质量控制、输出规格 | 模型选择、图像尺寸、采样步数、LoRA等 |
| **系统整合** | 参数合并、工作流执行、结果返回 | 自动处理，用户无感知 |

### 📝 Agent提示词编写建议

1. **专注描述内容**：详细描述想要的图像内容、风格、氛围
2. **避免技术参数**：不需要指定尺寸、步数、模型等技术细节
3. **使用艺术术语**：如"highly detailed"、"photorealistic"、"epic scene"等
4. **考虑光线构图**：描述光线效果、视角、构图等艺术要素

### 🔄 完整参数调用（高级用户）
如需临时覆盖用户配置，可使用完整参数调用：

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」ComfyUIGen「末」,
prompt:「始」a cute cat sitting on a windowsill, sunlight, photorealistic「末」,
negative_prompt:「始」low quality, blurry, distorted「末」,
width:「始」768「末」,
height:「始」512「末」,
steps:「始」25「末」,
cfg_scale:「始」7.5「末」,
seed:「始」12345「末」
<<<[END_TOOL_REQUEST]>>>
```

## 参数说明

### 支持的参数列表

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| **prompt** | string | ✅ | - | 正面提示词，描述想要生成的图像内容 |
| negative_prompt | string | ❌ | "lowres, bad anatomy..." | 负面提示词，描述不想要的内容 |
| width | number | ❌ | 1024 | 图像宽度（像素），建议64的倍数 |
| height | number | ❌ | 1024 | 图像高度（像素），建议64的倍数 |
| steps | number | ❌ | 20 | 采样步数，影响图像质量（1-150） |
| cfg_scale | number | ❌ | 7.0 | CFG引导强度，控制提示词遵循度（0.1-30） |
| seed | number | ❌ | 随机 | 随机种子，用于复现相同结果 |
| sampler_name | string | ❌ | "euler" | 采样器：euler, dpm++_2m, ddim等 |
| scheduler | string | ❌ | "normal" | 调度器：normal, karras, exponential |
| workflow | string | ❌ | "text2img_basic" | 工作流模板名称 |
| MODEL_NAME | string | ❌ | 配置文件中的值 | 模型文件名（.ckpt/.safetensors） |
| lora_name | string | ❌ | "" | LoRA模型名称（可选） |

### 参数使用建议

**🎯 Agent用户（推荐）：**
- 只使用 `prompt` 和 `negative_prompt`
- 让用户通过前端配置技术参数
- 专注于创意描述和艺术指导

**🔧 高级用户：**
- 可以使用完整参数进行精确控制
- 建议先通过前端设置基础配置
- 然后按需覆盖特定参数

**⚡ 性能考虑：**
- 较大分辨率（>1024x1024）需要更多GPU内存
- 更多采样步数（>30）会显著增加生成时间
- 复杂工作流可能需要更长处理时间

## 故障排除

### Bug修复记录 (2025-01-30)

#### 第一阶段：IPC处理器注册问题
**问题**: ComfyUI功能无法正常工作 - 无法加载模型、无法保存设置、无法测试连接
- 错误信息: `Error: No handler registered for 'get-comfyui-models'`

**根本原因**: IPC handlers初始化参数传递错误，导致处理器链式初始化失败

**修复内容**:
1. **修复chatHandlers初始化** (`main.js:138-147`): 提供mainWindow和完整context
2. **修复groupChatHandlers初始化** (`main.js:158-164`): 提供mainWindow和context 
3. **修复diceHandlers初始化** (`main.js:197`): 提供projectRoot参数

**修复结果**: ✅ IPC处理器成功注册，后端连接正常

#### 第二阶段：架构独立性问题  
**问题**: ComfyUI使用了VCPChat的settings.json，违反独立配置原则

**根本原因**: 配置系统混杂，前端覆盖能力不足

**修复内容**:
- **独立配置系统重构** (`comfyuiHandlers.js`):
  - 创建独立的 `comfyui-settings.json` 配置文件
  - 实现config.env + 用户设置的优先级配置机制
  - 用户设置 > config.env > 系统默认值

**修复结果**: ✅ 配置系统独立，前端可完全覆盖后端设置

#### 第三阶段：网络连接兼容性问题
**问题**: Electron环境下axios请求持续502错误，影响模型获取

**根本原因**: Electron安全策略可能阻止HTTP请求

**修复内容**:
- **双重HTTP客户端策略** (`comfyuiHandlers.js`):
  ```javascript
  // 主要使用axios，失败时自动切换到原生HTTP
  try {
    const comfyuiAxios = await createComfyUIAxios();
    response = await comfyuiAxios.get('/object_info');
  } catch (axiosError) {
    response = await makeComfyUIRequest('/object_info');
  }
  ```

**修复结果**: ✅ 后端成功获取15个模型和77个LoRA

#### 第四阶段：前端显示功能缺失
**问题**: 后端数据获取成功，但前端无法显示模型列表，缺少LoRA界面

**根本原因**: 前端JavaScript功能不完整
- 缺少 `loadLorasBtn` 事件监听器
- 使用简单的 `prompt()` 对话框而非专业UI
- 前端试图调用不存在的 `getComfyUILoras()` IPC接口

**修复内容**:
1. **实现完整的前端交互** (`settingsManager.js`):
   - 添加LoRA按钮事件监听器
   - 创建专业的模态选择界面替换prompt对话框
   - 实现搜索和筛选功能

2. **优化数据流架构**:
   - 发现后端 `get-comfyui-models` 已同时返回models和loras数据
   - 实现前端缓存机制避免重复请求
   - 统一使用单一后端接口，前端分别处理models和loras数据

3. **增强配置管理**:
   - 添加LoRA配置字段支持
   - 实现配置变更时的缓存失效
   - 完善表单数据的加载和保存逻辑

**修复结果**: 
- ✅ 用户可通过专业模态界面选择15个模型
- ✅ 用户可通过专业模态界面选择77个LoRA  
- ✅ 支持搜索和实时筛选
- ✅ LoRA配置可正确保存和加载
- ✅ 前端界面响应流畅，用户体验优良

#### 最终成果
**完整功能链路已打通**:
1. **后端数据获取**: 成功连接ComfyUI服务器，获取完整模型和LoRA列表
2. **前端界面展示**: 专业的模态选择界面，支持搜索和筛选
3. **配置管理系统**: 独立配置文件，支持前端完全覆盖后端设置  
4. **网络容错机制**: 双重HTTP客户端确保连接稳定性

**当前状态**: ✅ 所有ComfyUI功能正常工作，前后端完全集成

### 常见问题

1. **连接失败**: 检查COMFYUI_BASE_URL是否正确
2. **生成超时**: 增加队列检查次数或间隔
3. **模型未找到**: 确保ComfyUI中有对应的模型文件
4. **权限错误**: 检查COMFYUI_API_KEY配置
5. **前端配置无效**: 确保VCPChat中ComfyUI开关已启用

### 调试模式

在config.env中设置:
```
DEBUG_MODE=true
```

查看详细的调试信息来定位问题。

## 开发说明

### 工作流更新逻辑

插件会自动识别并更新工作流中的关键节点：

- **CLIPTextEncode**: 更新提示词
- **KSampler**: 更新采样参数
- **EmptyLatentImage**: 更新图像尺寸

### 前端开发

**关键文件**:
- `main.html`: UI界面定义
- `settingsManager.js`: 前端逻辑处理
- `preload.js`: IPC接口定义
- `comfyuiHandlers.js`: 后端处理器
- `main.js`: 主程序集成

**开发注意事项**:
- 所有配置数据存储在独立的 `comfyui-settings.json` 文件中  
- 前端UI采用模态框设计，与现有界面风格保持一致
- 错误处理采用toast通知方式，用户友好
- 支持实时连接测试和模型列表更新
- 实现了前端缓存机制，提升用户体验

### 扩展功能

可以通过修改 `updateWorkflowWithParams` 函数来支持更多节点类型和参数。

## 更新日志

### v0.2.1 - 用户手册更新 (2025-07-29)
- 📄 **重新编写用户手册**: 明确区分不同用户群体的使用方式
- 📊 **强调架构优势**: 详细说明前后端解耦设计
- 🔧 **丰富配置说明**: 为开发者和普通用户提供不同的配置方案
- 📝 **优化Agent指导**: 更加具体的提示词编写建议
- 🔍 **完善故障排除**: 添加常见问题解决方案和调试方法
- 📚 **添加部署指导**: 详细的插件注册和文件放置说明

### v0.2.0 - 重大架构升级 (2025-01-30) 🎉
- 🚀 **完成前后端配置链路集成**: 全面打通VCPChat前端配置到ComfyUIGen后端的数据流
- 🎨 **优化Agent-ComfyUI协作模式**: Agent专注创意，用户配置技术参数，后端自动整合
- 🔧 **前端界面全面优化**:
  - 测试连接按钮移至服务器地址配置后，改善交互体验
  - 添加工作流选择下拉菜单，支持动态加载和刷新
  - 完善模型和LoRA选择界面，支持搜索和筛选
- 🏗️ **后端配置系统重构**:
  - 实现配置优先级：Agent参数 > 用户配置 > 环境变量 > 默认值
  - 集成placeholder-processor.js，使用占位符驱动的工作流更新
  - 建立统一的参数验证和转换系统
- 🎯 **LoRA功能完整实现**:
  - 默认工作流支持LoRA加载节点
  - 前端LoRA选择界面与后端完全打通
  - LoRA强度参数可配置（默认1.0）
- 📋 **工作流管理系统**:
  - 动态扫描workflows目录，自动发现工作流模板
  - IPC接口支持工作流列表刷新
  - 支持自定义工作流上传
- 📝 **文档和清单更新**:
  - plugin-manifest.json升级到v0.2.0，优化工具描述
  - README.md全面更新，明确Agent调用方式和工作分工
  - 添加Agent提示词编写建议和最佳实践

### 2025-01-30 v0.1.1 - 重大Bug修复
- 🐛 **修复ComfyUI功能无法使用的问题**  
  - **第一阶段**: 修复IPC handlers初始化参数传递错误
  - **第二阶段**: 重构独立配置系统，避免与VCPChat设置混杂
  - **第三阶段**: 实现双重HTTP客户端解决Electron网络兼容性问题
  - **第四阶段**: 完善前端JavaScript功能，实现专业的模型/LoRA选择界面
  - 最终结果: 成功连接ComfyUI服务器，获取15个模型和77个LoRA，前端界面完全可用

### 2025-01-29 v0.1.0 - 初始版本
- ✅ 完成VCPChat前端界面集成
- ✅ 实现完整的参数配置系统
- ✅ 添加后端IPC处理器
- ✅ 集成连接测试和模型加载功能
- ✅ 建立前后端完整的数据流