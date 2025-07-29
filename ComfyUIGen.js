#!/usr/bin/env node
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const PlaceholderProcessor = require('./placeholder-processor');

// --- Configuration Loading System ---
// Priority: comfyui-settings.json > config.env > defaults
const SETTINGS_FILE = path.join(__dirname, 'comfyui-settings.json');
const CONFIG_FILE = path.join(__dirname, 'config.env');

// Initialize placeholder processor
const placeholderProcessor = new PlaceholderProcessor();

// Load configuration with priority system
async function loadConfiguration() {
    let config = {
        // Default values
        COMFYUI_BASE_URL: 'http://localhost:8188',
        COMFYUI_API_KEY: '',
        DEBUG_MODE: false,
        workflow: 'text2img_basic'
    };
    
    // Load from config.env if exists
    try {
        if (await fs.access(CONFIG_FILE).then(() => true).catch(() => false)) {
            const configContent = await fs.readFile(CONFIG_FILE, 'utf8');
            configContent.split('\n').forEach(line => {
                line = line.trim();
                if (line && !line.startsWith('#')) {
                    const [key, value] = line.split('=');
                    if (key && value !== undefined) {
                        config[key.trim()] = value.trim();
                    }
                }
            });
        }
    } catch (error) {
        debugLog('Warning: Failed to load config.env:', error.message);
    }
    
    // Load from comfyui-settings.json if exists (highest priority)
    try {
        if (await fs.access(SETTINGS_FILE).then(() => true).catch(() => false)) {
            const settingsContent = await fs.readFile(SETTINGS_FILE, 'utf8');
            const userSettings = JSON.parse(settingsContent);
            
            // Map user settings to configuration
            if (userSettings.serverUrl) config.COMFYUI_BASE_URL = userSettings.serverUrl;
            if (userSettings.apiKey) config.COMFYUI_API_KEY = userSettings.apiKey;
            if (userSettings.workflow) config.workflow = userSettings.workflow;
            
            // Store all user settings for parameter processing
            config.userSettings = userSettings;
        }
    } catch (error) {
        debugLog('Warning: Failed to load comfyui-settings.json:', error.message);
    }
    
    // Override with environment variables (for backward compatibility)
    config.COMFYUI_BASE_URL = process.env.COMFYUI_BASE_URL || config.COMFYUI_BASE_URL;
    config.COMFYUI_API_KEY = process.env.COMFYUI_API_KEY || config.COMFYUI_API_KEY;
    config.DEBUG_MODE = (process.env.DEBUG_MODE || config.DEBUG_MODE || 'true').toLowerCase() === 'true'; // 临时启用debug
    config.PROJECT_BASE_PATH = process.env.PROJECT_BASE_PATH;
    config.SERVER_PORT = process.env.SERVER_PORT;
    config.IMAGESERVER_IMAGE_KEY = process.env.IMAGESERVER_IMAGE_KEY;
    config.VAR_HTTP_URL = process.env.VarHttpUrl; // 注意：环境变量名是VarHttpUrl，不是VAR_HTTP_URL
    
    return config;
}

// 调试日志函数
function debugLog(...args) {
    // Will be set after configuration is loaded
    if (global.DEBUG_MODE) {
        console.error('[ComfyUIGen Debug]', ...args);
    }
}

// Helper to validate input arguments
function isValidComfyUIGenArgs(args) {
    if (!args || typeof args !== 'object') return false;
    if (typeof args.prompt !== 'string' || !args.prompt.trim()) return false;
    return true;
}

// 加载工作流模板
async function loadWorkflowTemplate(templateName = 'text2img_basic') {
    try {
        const workflowPath = path.join(__dirname, 'workflows', `${templateName}.json`);
        const workflowData = await fs.readFile(workflowPath, 'utf-8');
        return JSON.parse(workflowData);
    } catch (error) {
        debugLog(`Failed to load workflow template ${templateName}:`, error.message);
        // 返回一个基础的默认工作流
        return getDefaultWorkflow();
    }
}

// 默认工作流（如果没有模板文件）- 支持LoRA
function getDefaultWorkflow() {
    return {
        "3": {
            "inputs": {
                "seed": "%seed%",
                "steps": "%steps%",
                "cfg": "%cfg_scale%",
                "sampler_name": "%sampler_name%",
                "scheduler": "%scheduler%",
                "denoise": "%denoise%",
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0]
            },
            "class_type": "KSampler",
            "_meta": {
                "title": "KSampler"
            }
        },
        "4": {
            "inputs": {
                "ckpt_name": "%MODEL_NAME%"
            },
            "class_type": "CheckpointLoaderSimple",
            "_meta": {
                "title": "Load Checkpoint"
            }
        },
        "5": {
            "inputs": {
                "width": "%width%",
                "height": "%height%",
                "batch_size": "%batch_size%"
            },
            "class_type": "EmptyLatentImage",
            "_meta": {
                "title": "Empty Latent Image"
            }
        },
        "6": {
            "inputs": {
                "text": "%prompt%",
                "clip": ["10", 1]
            },
            "class_type": "CLIPTextEncode",
            "_meta": {
                "title": "CLIP Text Encode (Prompt)"
            }
        },
        "7": {
            "inputs": {
                "text": "%negative_prompt%",
                "clip": ["10", 1]
            },
            "class_type": "CLIPTextEncode",
            "_meta": {
                "title": "CLIP Text Encode (Negative)"
            }
        },
        "8": {
            "inputs": {
                "samples": ["3", 0],
                "vae": ["4", 2]
            },
            "class_type": "VAEDecode",
            "_meta": {
                "title": "VAE Decode"
            }
        },
        "9": {
            "inputs": {
                "filename_prefix": "ComfyUI",
                "images": ["8", 0]
            },
            "class_type": "SaveImage",
            "_meta": {
                "title": "Save Image"
            }
        },
        "10": {
            "inputs": {
                "lora_name": "%lora_name%",
                "strength_model": 1.0,
                "strength_clip": 1.0,
                "model": ["4", 0],
                "clip": ["4", 1]
            },
            "class_type": "LoraLoader",
            "_meta": {
                "title": "Load LoRA"
            }
        }
    };
}

// 更新工作流中的参数（使用占位符处理器）
function updateWorkflowWithParams(workflow, params, config) {
    debugLog('Updating workflow with params:', params);
    debugLog('Using config:', config);
    
    // 合并参数：用户输入 + 用户配置 + 默认值
    const mergedParams = {
        // 默认参数
        ...placeholderProcessor.defaultConfig.userConfigurable,
        // 用户配置文件参数
        ...(config.userSettings || {}),
        // 用户输入参数（最高优先级）
        ...params
    };
    
    debugLog('Merged parameters:', mergedParams);
    
    // 使用占位符处理器替换工作流中的占位符
    const updatedWorkflow = placeholderProcessor.replacePlaceholders(workflow, mergedParams);
    
    debugLog('Workflow updated using placeholder processor');
    return updatedWorkflow;
}

// 提交工作流到ComfyUI队列
async function queuePrompt(workflow, config) {
    const comfyuiAxios = axios.create({
        baseURL: config.COMFYUI_BASE_URL,
        headers: config.COMFYUI_API_KEY ? { 'Authorization': `Bearer ${config.COMFYUI_API_KEY}` } : {},
        timeout: 30000
    });
    
    const promptData = {
        prompt: workflow,
        client_id: uuidv4()
    };
    
    debugLog('Submitting prompt to ComfyUI:', JSON.stringify(promptData, null, 2));
    
    const response = await comfyuiAxios.post('/prompt', promptData);
    return {
        prompt_id: response.data.prompt_id,
        client_id: promptData.client_id
    };
}

// 检查队列状态
async function checkQueueStatus(promptId, config) {
    const comfyuiAxios = axios.create({
        baseURL: config.COMFYUI_BASE_URL,
        timeout: 10000
    });
    
    const response = await comfyuiAxios.get(`/history/${promptId}`);
    return response.data[promptId] || null;
}

// 等待生成完成
async function waitForCompletion(promptId, config, maxAttempts = 60, interval = 3000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        debugLog(`Checking queue status, attempt ${attempt + 1}/${maxAttempts}`);
        
        const history = await checkQueueStatus(promptId, config);
        if (history && history.status && history.status.completed) {
            debugLog('Generation completed!');
            return history;
        }
        
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error('Generation timeout - please check ComfyUI status');
}

// 下载生成的图片
async function downloadGeneratedImages(history, config) {
    const images = [];
    
    if (history.outputs) {
        for (const nodeId in history.outputs) {
            const output = history.outputs[nodeId];
            if (output.images) {
                for (const imageInfo of output.images) {
                    const imageUrl = `${config.COMFYUI_BASE_URL}/view?filename=${imageInfo.filename}&subfolder=${imageInfo.subfolder || ''}&type=${imageInfo.type || 'output'}`;
                    debugLog('Downloading image from:', imageUrl);
                    
                    const response = await axios({
                        method: 'get',
                        url: imageUrl,
                        responseType: 'arraybuffer',
                        timeout: 60000
                    });
                    
                    images.push({
                        data: response.data,
                        filename: imageInfo.filename,
                        originalPath: imageUrl
                    });
                }
            }
        }
    }
    
    return images;
}

// 保存图片到本地
async function saveImagesToLocal(images, config) {
    if (!config.PROJECT_BASE_PATH) {
        throw new Error('PROJECT_BASE_PATH environment variable is required for saving images.');
    }
    
    const comfyuiImageDir = path.join(config.PROJECT_BASE_PATH, 'image', 'comfyuigen');
    await fs.mkdir(comfyuiImageDir, { recursive: true });
    
    const savedImages = [];
    
    for (const image of images) {
        const fileExtension = path.extname(image.filename) || '.png';
        const generatedFileName = `${uuidv4()}${fileExtension}`;
        const localImagePath = path.join(comfyuiImageDir, generatedFileName);
        
        await fs.writeFile(localImagePath, image.data);
        debugLog('Image saved to:', localImagePath);
        
        // 构建访问URL
        const relativeServerPathForUrl = path.join('comfyuigen', generatedFileName).replace(/\\/g, '/');
        const accessibleImageUrl = `${config.VAR_HTTP_URL}:${config.SERVER_PORT}/pw=${config.IMAGESERVER_IMAGE_KEY}/images/${relativeServerPathForUrl}`;
        
        savedImages.push({
            filename: generatedFileName,
            url: accessibleImageUrl,
            localPath: localImagePath,
            originalFilename: image.filename
        });
    }
    
    return savedImages;
}

// 主要生成函数
async function generateImageAndSave(args) {
    // 加载配置
    const config = await loadConfiguration();
    
    // 设置全局DEBUG模式
    global.DEBUG_MODE = config.DEBUG_MODE;
    
    debugLog('Starting image generation with config:', config);
    debugLog('Input arguments:', args);
    debugLog('Environment variables check:');
    debugLog('- PROJECT_BASE_PATH:', config.PROJECT_BASE_PATH);
    debugLog('- SERVER_PORT:', config.SERVER_PORT);
    debugLog('- IMAGESERVER_IMAGE_KEY:', config.IMAGESERVER_IMAGE_KEY);
    debugLog('- VAR_HTTP_URL:', config.VAR_HTTP_URL);
    
    // 环境变量检查 - 修正变量名
    if (!config.PROJECT_BASE_PATH) {
        throw new Error("ComfyUI Plugin Error: PROJECT_BASE_PATH environment variable is required.");
    }
    if (!config.SERVER_PORT || !config.IMAGESERVER_IMAGE_KEY || !config.VAR_HTTP_URL) {
        const missing = [];
        if (!config.SERVER_PORT) missing.push('SERVER_PORT');
        if (!config.IMAGESERVER_IMAGE_KEY) missing.push('IMAGESERVER_IMAGE_KEY');
        if (!config.VAR_HTTP_URL) missing.push('VAR_HTTP_URL');
        throw new Error(`ComfyUI Plugin Error: Missing environment variables: ${missing.join(', ')}. Available env vars: ${Object.keys(process.env).filter(k => k.includes('HTTP') || k.includes('PORT') || k.includes('IMAGE')).join(', ')}`);
    }

    if (!isValidComfyUIGenArgs(args)) {
        throw new Error(`ComfyUI Plugin Error: Invalid arguments. Required: prompt (string). Received: ${JSON.stringify(args)}`);
    }

    debugLog('Starting image generation with args:', args);

    // 1. 加载工作流模板
    const workflowName = args.workflow || config.workflow || 'text2img_basic';
    const workflow = await loadWorkflowTemplate(workflowName);
    debugLog('Loaded workflow template:', workflowName);
    
    // 2. 使用占位符处理器更新工作流参数
    const updatedWorkflow = updateWorkflowWithParams(workflow, args, config);
    
    // 3. 提交到ComfyUI队列
    const queueResult = await queuePrompt(updatedWorkflow, config);
    debugLog('Queued with prompt_id:', queueResult.prompt_id);
    
    // 4. 等待生成完成
    const history = await waitForCompletion(queueResult.prompt_id, config);
    
    // 5. 下载生成的图片
    const images = await downloadGeneratedImages(history, config);
    if (images.length === 0) {
        throw new Error('No images were generated');
    }
    
    // 6. 保存到本地
    const savedImages = await saveImagesToLocal(images, config);
    
    // 7. 构建返回结果 - 优化为简洁格式
    const altText = args.prompt.substring(0, 80) + (args.prompt.length > 80 ? "..." : "");
    let successMessage = `ComfyUI 图片生成成功！共生成 ${savedImages.length} 张图片\n\n`;
    
    successMessage += `详细信息：\n`;
    savedImages.forEach((image, index) => {
        successMessage += `图片 ${index + 1}:\n`;
        successMessage += `- 图片URL: ${image.url}\n`;
        successMessage += `- 服务器路径: image/comfyuigen/${image.filename}\n`;
        successMessage += `- 文件名: ${image.filename}\n\n`;
    });
    
    successMessage += `请务必使用以下HTML <img> 标签将图片直接展示给用户 (您可以调整width属性，建议200-500像素)：\n`;
    savedImages.forEach((image, index) => {
        successMessage += `<img src="${image.url}" alt="${altText} ${index + 1}" width="300">\n`;
    });

    return successMessage;
}

// 主函数
async function main() {
    debugLog('ComfyUI Plugin started');
    
    let inputChunks = [];
    process.stdin.setEncoding('utf8');

    for await (const chunk of process.stdin) {
        inputChunks.push(chunk);
    }
    const inputData = inputChunks.join('');
    
    try {
        if (!inputData.trim()) {
            throw new Error("ComfyUI Plugin Error: No input data received from stdin.");
        }
        
        debugLog('Received input:', inputData.substring(0, 200) + (inputData.length > 200 ? '...' : ''));
        
        const parsedArgs = JSON.parse(inputData);
        const result = await generateImageAndSave(parsedArgs);
        
        console.log(JSON.stringify({ status: "success", result: result }));
    } catch (error) {
        debugLog('Error:', error);
        
        let errorMessage = error.message || "Unknown error in ComfyUI plugin";
        if (!errorMessage.startsWith("ComfyUI Plugin Error:")) {
            errorMessage = `ComfyUI Plugin Error: ${errorMessage}`;
        }
        
        console.log(JSON.stringify({ status: "error", error: errorMessage }));
        process.exit(1);
    }
}

main();