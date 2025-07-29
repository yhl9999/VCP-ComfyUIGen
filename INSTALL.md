# ComfyUIGen 安装指南

## 🚀 快速安装

### 1. 插件安装
将此仓库的内容复制到你的VCPToolBox插件目录：
```bash
git clone https://github.com/yhl9999/VCP-ComfyUIGen.git
cp -r VCP-ComfyUIGen/* /path/to/VCPToolBox/Plugin/ComfyUIGen/
```

### 2. 依赖安装
```bash
cd /path/to/VCPToolBox/Plugin/ComfyUIGen/
npm install
```

### 3. 配置文件
```bash
# 复制配置模板
cp config.env.example config.env

# 根据你的ComfyUI服务器配置修改 config.env
nano config.env
```

### 4. ComfyUI服务器
确保ComfyUI服务器正在运行：
```bash
# 默认地址
http://localhost:8188
```

### 5. VCPChat前端集成
如果你使用VCPChat前端，需要集成前端文件：
```bash
# 复制前端集成文件到VCPChat
cp VCPChat-Integration/* /path/to/VCPChat/
```

## 🔧 配置说明

### config.env 配置
```bash
# ComfyUI服务器地址
COMFYUI_BASE_URL=http://localhost:8188

# API密钥（如果ComfyUI启用了认证）
COMFYUI_API_KEY=your_api_key

# 项目路径（用于保存生成的图片）
PROJECT_BASE_PATH=/path/to/your/project

# 调试模式
DEBUG_MODE=true
```

## ✅ 验证安装

### 测试插件功能
```bash
cd /path/to/VCPToolBox/Plugin/ComfyUIGen/
echo '{"prompt":"a beautiful sunset"}' | node ComfyUIGen.js
```

### 检查ComfyUI连接
在VCPChat中测试连接或直接访问：
```
http://localhost:8188/object_info
```

## 📝 注意事项

1. 确保ComfyUI服务器正在运行
2. 检查防火墙设置允许8188端口访问
3. 确保有足够的GPU内存用于图像生成
4. 安装适当的ComfyUI模型文件

## ❗ 故障排除

如果遇到问题，请检查：
1. ComfyUI服务器状态
2. 网络连接
3. 配置文件格式
4. 依赖包安装
5. 权限设置

详细故障排除请参考 [README.md](README.md) 中的故障排除章节。