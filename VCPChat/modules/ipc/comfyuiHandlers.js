/**
 * comfyuiHandlers.js
 * 
 * Handles ComfyUI related IPC communication between renderer and main process
 */

const { ipcMain } = require('electron');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const http = require('http');
const https = require('https');

// ComfyUI Plugin configuration path
const COMFYUI_PLUGIN_DIR = path.resolve(__dirname, '..', '..', '..', 'VCPToolBox', 'Plugin', 'ComfyUIGen');
const COMFYUI_CONFIG_FILE = path.join(COMFYUI_PLUGIN_DIR, 'config.env');
const COMFYUI_SETTINGS_FILE = path.join(COMFYUI_PLUGIN_DIR, 'comfyui-settings.json');

// Default ComfyUI configuration
const defaultComfyUIConfig = {
    seed: 156680208700286,
    steps: 20,
    cfg_scale: 7,
    sampler_name: 'euler',
    scheduler: 'normal',
    width: 1024,
    height: 1024,
    MODEL_NAME: 'v1-5-pruned-emaonly.ckpt',
    negative_prompt: 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry'
};

// Load configuration from config.env file
function loadConfig() {
    try {
        if (!fs.existsSync(COMFYUI_CONFIG_FILE)) {
            console.warn('[ComfyUI] config.env not found, using defaults');
            return {
                COMFYUI_BASE_URL: 'http://localhost:8188',
                COMFYUI_API_KEY: '',
                DEBUG_MODE: 'false'
            };
        }
        
        const configContent = fs.readFileSync(COMFYUI_CONFIG_FILE, 'utf8');
        const config = {};
        
        configContent.split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [key, value] = line.split('=');
                if (key && value !== undefined) {
                    config[key.trim()] = value.trim();
                }
            }
        });
        
        return config;
    } catch (error) {
        console.error('[ComfyUI] Failed to load config.env:', error.message);
        return {
            COMFYUI_BASE_URL: 'http://localhost:8188',
            COMFYUI_API_KEY: '',
            DEBUG_MODE: 'false'
        };
    }
}

// Helper function to get ComfyUI server URL from user settings first, then config.env
async function getComfyUIServerUrl() {
    try {
        // First try to get URL from user settings
        if (await fs.pathExists(COMFYUI_SETTINGS_FILE)) {
            const userSettings = await fs.readJson(COMFYUI_SETTINGS_FILE);
            if (userSettings.serverUrl) {
                console.log('[ComfyUI] Using server URL from user settings:', userSettings.serverUrl);
                return userSettings.serverUrl;
            }
        }
        
        // Fallback to config.env
        const config = loadConfig();
        const url = config.COMFYUI_BASE_URL || 'http://localhost:8188';
        console.log('[ComfyUI] Using server URL from config.env:', url);
        return url;
    } catch (error) {
        console.warn('[ComfyUI] Failed to get server URL, using default:', error.message);
        return 'http://localhost:8188';
    }
}

// Helper function to get ComfyUI API key from user settings first, then config.env
async function getComfyUIApiKey() {
    try {
        // First try to get API key from user settings
        if (await fs.pathExists(COMFYUI_SETTINGS_FILE)) {
            const userSettings = await fs.readJson(COMFYUI_SETTINGS_FILE);
            if (userSettings.apiKey) {
                return userSettings.apiKey;
            }
        }
        
        // Fallback to config.env
        const config = loadConfig();
        return config.COMFYUI_API_KEY || null;
    } catch (error) {
        console.warn('[ComfyUI] Failed to get API key:', error.message);
        return null;
    }
}

// Create axios instance for ComfyUI API calls
async function createComfyUIAxios() {
    const baseURL = await getComfyUIServerUrl();
    const apiKey = await getComfyUIApiKey();
    
    const headers = {
        'User-Agent': 'VCPChat-ComfyUI-Client/1.0'
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    const axiosInstance = axios.create({
        baseURL,
        headers,
        timeout: 15000,
        // Add more specific axios config for Electron
        validateStatus: function (status) {
            return status >= 200 && status < 300; // default
        },
        maxRedirects: 5,
        // Disable proxy
        proxy: false,
        // Add more debugging
        transformRequest: [function (data, headers) {
            console.log('[ComfyUI] Making HTTP request with headers:', headers);
            return data;
        }]
    });
    
    // Add request interceptor for debugging
    axiosInstance.interceptors.request.use(function (config) {
        console.log('[ComfyUI] Request interceptor - URL:', `${config.baseURL}${config.url}`);
        console.log('[ComfyUI] Request interceptor - Method:', config.method);
        return config;
    }, function (error) {
        console.error('[ComfyUI] Request interceptor error:', error);
        return Promise.reject(error);
    });
    
    // Add response interceptor for debugging
    axiosInstance.interceptors.response.use(function (response) {
        console.log('[ComfyUI] Response interceptor - Status:', response.status);
        return response;
    }, function (error) {
        console.error('[ComfyUI] Response interceptor error:', error.message);
        console.error('[ComfyUI] Response interceptor error code:', error.code);
        return Promise.reject(error);
    });
    
    return axiosInstance;
}

// Fallback HTTP request using native Node.js http module
async function makeComfyUIRequest(endpoint = '/object_info') {
    return new Promise(async (resolve, reject) => {
        try {
            const serverUrl = await getComfyUIServerUrl();
            const url = new URL(endpoint, serverUrl);
            
            console.log('[ComfyUI] Fallback HTTP request to:', url.href);
            
            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname,
                method: 'GET',
                headers: {
                    'User-Agent': 'VCPChat-ComfyUI-Client/1.0',
                    'Accept': 'application/json'
                },
                timeout: 15000
            };
            
            const client = url.protocol === 'https:' ? https : http;
            
            const req = client.request(options, (res) => {
                console.log('[ComfyUI] Fallback HTTP response status:', res.statusCode);
                
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    return;
                }
                
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve({
                            status: res.statusCode,
                            statusText: res.statusMessage,
                            data: jsonData
                        });
                    } catch (error) {
                        reject(new Error(`Failed to parse JSON: ${error.message}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                console.error('[ComfyUI] Fallback HTTP request error:', error.message);
                reject(error);
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.setTimeout(15000);
            req.end();
            
        } catch (error) {
            reject(error);
        }
    });
}

// Save ComfyUI settings to independent settings file
async function saveComfyUISettings(settings) {
    try {
        // Ensure plugin directory exists
        await fs.ensureDir(COMFYUI_PLUGIN_DIR);
        
        // Load existing settings
        let existingSettings = {};
        try {
            existingSettings = await fs.readJson(COMFYUI_SETTINGS_FILE);
        } catch (error) {
            console.log('[ComfyUI] Creating new settings file');
        }
        
        // Merge settings
        const mergedSettings = { ...defaultComfyUIConfig, ...existingSettings, ...settings };
        
        // Save to independent settings file
        await fs.writeJson(COMFYUI_SETTINGS_FILE, mergedSettings, { spaces: 2 });
        
        console.log('[ComfyUI] Settings saved to:', COMFYUI_SETTINGS_FILE);
        return { success: true };
    } catch (error) {
        console.error('[ComfyUI] Failed to save settings:', error);
        return { success: false, error: error.message };
    }
}

// Load ComfyUI settings from independent settings file
async function loadComfyUISettings() {
    try {
        if (await fs.pathExists(COMFYUI_SETTINGS_FILE)) {
            const settings = await fs.readJson(COMFYUI_SETTINGS_FILE);
            return { ...defaultComfyUIConfig, ...settings };
        } else {
            return defaultComfyUIConfig;
        }
    } catch (error) {
        console.warn('[ComfyUI] Failed to load settings, using defaults:', error.message);
        return defaultComfyUIConfig;
    }
}

/**
 * Initializes ComfyUI related IPC handlers.
 * @param {object} paths - An object containing required paths.
 */
function initialize(paths) {
    console.log('[ComfyUI] Registering ComfyUI IPC handlers...');
    console.log('[ComfyUI] __dirname:', __dirname);
    console.log('[ComfyUI] ComfyUI Plugin directory:', COMFYUI_PLUGIN_DIR);
    console.log('[ComfyUI] Config file:', COMFYUI_CONFIG_FILE);
    console.log('[ComfyUI] Settings file:', COMFYUI_SETTINGS_FILE);
    console.log('[ComfyUI] Config file exists:', fs.existsSync(COMFYUI_CONFIG_FILE));
    console.log('[ComfyUI] Testing config loading...');
    
    try {
        const testConfig = loadConfig();
        console.log('[ComfyUI] Loaded config:', testConfig);
        // Test async server URL loading
        getComfyUIServerUrl().then(url => {
            console.log('[ComfyUI] Server URL from async config:', url);
        }).catch(err => {
            console.error('[ComfyUI] Failed to get server URL:', err.message);
        });
    } catch (error) {
        console.error('[ComfyUI] Failed to load config during init:', error);
    }

    /**
     * Save ComfyUI configuration
     */
    ipcMain.handle('save-comfyui-config', async (event, config) => {
        try {
            console.log('[ComfyUI] Saving ComfyUI configuration:', config);
            const result = await saveComfyUISettings(config);
            console.log('[ComfyUI] ComfyUI configuration saved successfully');
            return result;
        } catch (error) {
            console.error('[ComfyUI] Failed to save ComfyUI configuration:', error);
            return { success: false, error: error.message };
        }
    });

    /**
     * Test connection to ComfyUI server using /object_info endpoint
     */
    ipcMain.handle('test-comfyui-connection', async (event) => {
        try {
            console.log('[ComfyUI] Testing ComfyUI server connection...');
            
            const serverUrl = await getComfyUIServerUrl();
            console.log('[ComfyUI] Server URL:', serverUrl);
            
            // First try with axios
            try {
                const comfyuiAxios = await createComfyUIAxios();
                console.log('[ComfyUI] Trying axios request...');
                const response = await comfyuiAxios.get('/object_info');
                
                console.log('[ComfyUI] Axios connection test successful:', response.status);
                return { 
                    success: true, 
                    message: 'Connection successful (axios)',
                    serverUrl: await getComfyUIServerUrl()
                };
            } catch (axiosError) {
                console.log('[ComfyUI] Axios failed, trying fallback HTTP request...');
                console.log('[ComfyUI] Axios error:', axiosError.message);
                
                // Fallback to native HTTP
                const response = await makeComfyUIRequest('/object_info');
                
                console.log('[ComfyUI] Fallback HTTP connection test successful:', response.status);
                return { 
                    success: true, 
                    message: 'Connection successful (fallback HTTP)',
                    serverUrl: await getComfyUIServerUrl()
                };
            }
            
        } catch (error) {
            console.error('[ComfyUI] All connection methods failed:', error.message);
            return { 
                success: false, 
                error: `Connection failed: ${error.message}`,
                serverUrl: await getComfyUIServerUrl()
            };
        }
    });

    /**
     * Get available models and LoRAs from ComfyUI server
     */
    ipcMain.handle('get-comfyui-models', async (event) => {
        try {
            console.log('[ComfyUI] Getting available models from ComfyUI server...');
            console.log('[ComfyUI] Request triggered by:', event.sender.getURL());
            
            let response;
            
            // First try with axios
            try {
                const comfyuiAxios = await createComfyUIAxios();
                console.log('[ComfyUI] Trying axios request for models...');
                response = await comfyuiAxios.get('/object_info');
                console.log('[ComfyUI] Axios models request successful');
            } catch (axiosError) {
                console.log('[ComfyUI] Axios failed for models, trying fallback HTTP request...');
                console.log('[ComfyUI] Axios error:', axiosError.message);
                
                // Fallback to native HTTP
                response = await makeComfyUIRequest('/object_info');
                console.log('[ComfyUI] Fallback HTTP models request successful');
            }
            
            if (response.data) {
                const objectInfo = response.data;
                
                // Extract checkpoint models
                let models = [];
                if (objectInfo.CheckpointLoaderSimple && objectInfo.CheckpointLoaderSimple.input && objectInfo.CheckpointLoaderSimple.input.required) {
                    const checkpointInput = objectInfo.CheckpointLoaderSimple.input.required;
                    if (checkpointInput.ckpt_name && Array.isArray(checkpointInput.ckpt_name[0])) {
                        models = checkpointInput.ckpt_name[0];
                    }
                }
                
                // Extract LoRA models
                let loras = [];
                if (objectInfo.LoraLoader && objectInfo.LoraLoader.input && objectInfo.LoraLoader.input.required) {
                    const loraInput = objectInfo.LoraLoader.input.required;
                    if (loraInput.lora_name && Array.isArray(loraInput.lora_name[0])) {
                        loras = loraInput.lora_name[0];
                    }
                }
                
                console.log('[ComfyUI] Found models:', models.length);
                console.log('[ComfyUI] Found LoRAs:', loras.length);
                
                return { 
                    success: true, 
                    models: models.map(model => ({ name: model, id: model })),
                    loras: loras.map(lora => ({ name: lora, id: lora })),
                    serverUrl: await getComfyUIServerUrl()
                };
            } else {
                console.warn('[ComfyUI] No data received from ComfyUI server');
                return { 
                    success: false, 
                    error: 'No data received from ComfyUI server',
                    serverUrl: await getComfyUIServerUrl()
                };
            }
            
        } catch (error) {
            console.error('[ComfyUI] All methods failed to get models:', error.message);
            return { 
                success: false, 
                error: `Failed to get models: ${error.message}`,
                serverUrl: await getComfyUIServerUrl()
            };
        }
    });

    /**
     * Get ComfyUI settings from independent settings file
     */
    ipcMain.handle('get-comfyui-settings', async (event) => {
        try {
            const settings = await loadComfyUISettings();
            return { 
                success: true, 
                settings,
                serverUrl: await getComfyUIServerUrl()
            };
        } catch (error) {
            console.error('[ComfyUI] Failed to load settings:', error);
            return { 
                success: false, 
                error: error.message,
                settings: defaultComfyUIConfig,
                serverUrl: await getComfyUIServerUrl()
            };
        }
    });

    /**
     * Get available ComfyUI workflows from workflows directory
     */
    ipcMain.handle('get-comfyui-workflows', async (event) => {
        try {
            const workflowsDir = path.join(COMFYUI_PLUGIN_DIR, 'workflows');
            
            // Check if workflows directory exists
            if (!await fs.pathExists(workflowsDir)) {
                console.warn('[ComfyUI] Workflows directory not found:', workflowsDir);
                return {
                    success: true,
                    workflows: []
                };
            }
            
            // Read all .json files in workflows directory
            const files = await fs.readdir(workflowsDir);
            const workflows = [];
            
            for (const file of files) {
                if (path.extname(file) === '.json') {
                    const workflowId = path.basename(file, '.json');
                    const workflowPath = path.join(workflowsDir, file);
                    
                    try {
                        // Try to read workflow metadata
                        const workflowContent = await fs.readJson(workflowPath);
                        workflows.push({
                            id: workflowId,
                            name: workflowContent._meta?.title || workflowId,
                            description: workflowContent._meta?.description || '',
                            path: workflowPath
                        });
                    } catch (readError) {
                        console.warn(`[ComfyUI] Failed to read workflow ${file}:`, readError.message);
                        // Still add it to the list with basic info
                        workflows.push({
                            id: workflowId,
                            name: workflowId,
                            description: 'Failed to load metadata',
                            path: workflowPath
                        });
                    }
                }
            }
            
            console.log(`[ComfyUI] Found ${workflows.length} workflow files`);
            return {
                success: true,
                workflows
            };
        } catch (error) {
            console.error('[ComfyUI] Failed to get workflows:', error);
            return {
                success: false,
                error: error.message,
                workflows: []
            };
        }
    });

    console.log('[ComfyUI] ComfyUI IPC handlers registered successfully');
}

module.exports = {
    initialize,
    defaultComfyUIConfig
};