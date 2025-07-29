/**
 * ComfyUI Settings Module - JavaScript
 * 独立的ComfyUI配置管理模块
 * 
 * 功能特性:
 * - 服务器连接管理
 * - 模型和LoRA选择
 * - 工作流管理  
 * - 参数配置
 * - 配置导入导出
 */

class ComfyUISettingsModule {
    constructor() {
        this.config = {};
        this.cache = {
            models: [],
            loras: [],
            workflows: []
        };
        this.modal = new ModalManager(this);
        
        this.init();
    }

    async init() {
        this.bindEvents();
        this.setupRangeInputs();
        await this.loadConfig();
        this.updateUI();
    }

    // === 事件绑定 ===
    bindEvents() {
        // 连接和保存按钮
        document.getElementById('testConnectionBtn').addEventListener('click', () => this.testConnection());
        document.getElementById('saveConfigBtn').addEventListener('click', () => this.saveConfig());
        document.getElementById('resetConfigBtn').addEventListener('click', () => this.resetConfig());

        // 模型和资源加载
        document.getElementById('loadModelsBtn').addEventListener('click', () => this.loadModels());
        document.getElementById('loadLorasBtn').addEventListener('click', () => this.loadLoras());
        document.getElementById('refreshWorkflowsBtn').addEventListener('click', () => this.loadWorkflows());

        // 随机种子
        document.getElementById('randomSeedBtn').addEventListener('click', () => this.generateRandomSeed());

        // 配置导入导出
        document.getElementById('exportConfigBtn').addEventListener('click', () => this.exportConfig());
        document.getElementById('importConfigBtn').addEventListener('click', () => this.importConfig());

        // 输入变化监听
        this.bindInputChangeEvents();
    }

    bindInputChangeEvents() {
        const inputs = [
            'serverUrl', 'apiKey', 'modelName', 'loraName', 'workflow',
            'width', 'height', 'steps', 'cfgScale', 'samplerName', 
            'scheduler', 'seed', 'negativePrompt'
        ];

        inputs.forEach(inputId => {
            const element = document.getElementById(inputId);
            if (element) {
                element.addEventListener('input', () => this.onConfigChange());
                element.addEventListener('change', () => this.onConfigChange());
            }
        });
    }

    setupRangeInputs() {
        const ranges = [
            { id: 'width', valueId: 'widthValue', suffix: 'px' },
            { id: 'height', valueId: 'heightValue', suffix: 'px' },
            { id: 'steps', valueId: 'stepsValue', suffix: '' },
            { id: 'cfgScale', valueId: 'cfgScaleValue', suffix: '' }
        ];

        ranges.forEach(({ id, valueId, suffix }) => {
            const range = document.getElementById(id);
            const display = document.getElementById(valueId);
            
            if (range && display) {
                range.addEventListener('input', () => {
                    display.textContent = range.value + suffix;
                });
            }
        });
    }

    // === 配置管理 ===
    async loadConfig() {
        try {
            this.updateConnectionStatus('connecting', '加载配置中...');
            
            // 通过IPC从后端加载配置
            const result = await window.electronAPI.getComfyUISettings();
            const config = result.settings || {};
            this.config = { ...this.getDefaultConfig(), ...config };
            
            this.showToast('配置加载成功', 'success');
            this.updateConnectionStatus('connected', '配置已加载');
        } catch (error) {
            console.error('Failed to load config:', error);
            this.config = this.getDefaultConfig();
            this.showToast('配置加载失败，使用默认配置', 'error');
            this.updateConnectionStatus('error', '配置加载失败');
        }
    }

    async saveConfig() {
        try {
            // 收集当前UI中的配置
            this.collectConfigFromUI();
            
            // 通过IPC保存到后端
            await window.electronAPI.saveComfyUIConfig(this.config);
            
            this.showToast('配置保存成功', 'success');
            this.updateLastSaved();
        } catch (error) {
            console.error('Failed to save config:', error);
            this.showToast('配置保存失败: ' + error.message, 'error');
        }
    }

    collectConfigFromUI() {
        const fields = {
            serverUrl: 'serverUrl',
            apiKey: 'apiKey', 
            MODEL_NAME: 'modelName',
            lora_name: 'loraName',
            workflow: 'workflow',
            width: 'width',
            height: 'height',
            steps: 'steps',
            cfg_scale: 'cfgScale',
            sampler_name: 'samplerName',
            scheduler: 'scheduler',
            seed: 'seed',
            negative_prompt: 'negativePrompt'
        };

        Object.entries(fields).forEach(([configKey, elementId]) => {
            const element = document.getElementById(elementId);
            if (element) {
                let value = element.value;
                
                // 数值类型转换
                if (['width', 'height', 'steps', 'seed'].includes(elementId)) {
                    value = parseInt(value, 10) || 0;
                } else if (elementId === 'cfgScale') {
                    value = parseFloat(value) || 0;
                }
                
                this.config[configKey] = value;
            }
        });
    }

    updateUI() {
        const fields = {
            serverUrl: 'serverUrl',
            apiKey: 'apiKey',
            MODEL_NAME: 'modelName', 
            lora_name: 'loraName',
            workflow: 'workflow',
            width: 'width',
            height: 'height',
            steps: 'steps',
            cfg_scale: 'cfgScale',
            sampler_name: 'samplerName',
            scheduler: 'scheduler',
            seed: 'seed',
            negative_prompt: 'negativePrompt'
        };

        Object.entries(fields).forEach(([configKey, elementId]) => {
            const element = document.getElementById(elementId);
            if (element && this.config[configKey] !== undefined) {
                element.value = this.config[configKey];
                
                // 触发range输入的显示更新
                if (element.type === 'range') {
                    element.dispatchEvent(new Event('input'));
                }
            }
        });
    }

    async resetConfig() {
        if (confirm('确定要重置所有配置到默认值吗？此操作不可撤销。')) {
            this.config = this.getDefaultConfig();
            this.updateUI();
            this.showToast('配置已重置', 'warning');
        }
    }

    // === 连接测试 ===
    async testConnection() {
        const testBtn = document.getElementById('testConnectionBtn');
        const originalText = testBtn.textContent;
        
        try {
            testBtn.textContent = '测试中...';
            testBtn.disabled = true;
            this.updateConnectionStatus('connecting', '测试连接中...');
            
            const serverUrl = document.getElementById('serverUrl').value;
            const apiKey = document.getElementById('apiKey').value;
            
            const result = await window.electronAPI.testComfyUIConnection({
                serverUrl,
                apiKey
            });
            
            if (result.success) {
                this.showToast('连接成功！', 'success');
                this.updateConnectionStatus('connected', '连接正常');
            } else {
                throw new Error(result.error || '连接失败');
            }
        } catch (error) {
            console.error('Connection test failed:', error);
            this.showToast('连接失败: ' + error.message, 'error');
            this.updateConnectionStatus('error', '连接失败');
        } finally {
            testBtn.textContent = originalText;
            testBtn.disabled = false;
        }
    }

    // === 资源加载 ===
    async loadModels() {
        try {
            this.updateConnectionStatus('connecting', '加载模型中...');
            
            const result = await window.electronAPI.getComfyUIModels();
            if (result.success && result.models) {
                this.cache.models = result.models;
                this.populateModelSelect(result.models);
                this.showToast(`加载了 ${result.models.length} 个模型`, 'success');
                this.updateConnectionStatus('connected', '模型加载完成');
            } else {
                throw new Error(result.error || '未能获取模型列表');
            }
        } catch (error) {
            console.error('Failed to load models:', error);
            this.showToast('加载模型失败: ' + error.message, 'error');
            this.updateConnectionStatus('error', '模型加载失败');
        }
    }

    async loadLoras() {
        try {
            this.updateConnectionStatus('connecting', '加载LoRA中...');
            
            const result = await window.electronAPI.getComfyUIModels();
            if (result.success && result.loras) {
                this.cache.loras = result.loras;
                this.populateLoraSelect(result.loras);
                this.showToast(`加载了 ${result.loras.length} 个LoRA`, 'success');
                this.updateConnectionStatus('connected', 'LoRA加载完成');
            } else {
                throw new Error(result.error || '未能获取LoRA列表');
            }
        } catch (error) {
            console.error('Failed to load LoRAs:', error);
            this.showToast('加载LoRA失败: ' + error.message, 'error');
            this.updateConnectionStatus('error', 'LoRA加载失败');
        }
    }

    async loadWorkflows() {
        try {
            const result = await window.electronAPI.getComfyUIWorkflows();
            if (result.workflows) {
                this.cache.workflows = result.workflows;
                this.populateWorkflowSelect(result.workflows);
                this.showToast(`加载了 ${result.workflows.length} 个工作流`, 'success');
            }
        } catch (error) {
            console.error('Failed to load workflows:', error);
            this.showToast('加载工作流失败: ' + error.message, 'error');
        }
    }

    populateWorkflowSelect(workflows) {
        const select = document.getElementById('workflow');
        select.innerHTML = '';
        
        workflows.forEach(workflow => {
            const option = document.createElement('option');
            option.value = workflow.name;
            option.textContent = workflow.displayName || workflow.name;
            select.appendChild(option);
        });
    }

    populateModelSelect(models) {
        const select = document.getElementById('modelName');
        select.innerHTML = '<option value="">请选择模型...</option>';
        
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name || model;
            option.textContent = model.name || model;
            select.appendChild(option);
        });
    }

    populateLoraSelect(loras) {
        const select = document.getElementById('loraName');
        select.innerHTML = '<option value="">无（可选）</option>';
        
        loras.forEach(lora => {
            const option = document.createElement('option');
            option.value = lora.name || lora;
            option.textContent = lora.name || lora;
            select.appendChild(option);
        });
    }

    // === 工具函数 ===
    generateRandomSeed() {
        const seed = Math.floor(Math.random() * 4294967295);
        document.getElementById('seed').value = seed;
        this.onConfigChange();
    }

    onConfigChange() {
        // 标记配置已修改
        this.updateLastSaved('未保存的更改');
    }

    updateConnectionStatus(status, text) {
        const indicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        
        indicator.className = `status-indicator ${status}`;
        statusText.textContent = text;
    }

    updateLastSaved(text = null) {
        const lastSaved = document.getElementById('lastSaved');
        if (text) {
            lastSaved.textContent = text;
        } else {
            const now = new Date().toLocaleString();
            lastSaved.textContent = `最后保存: ${now}`;
        }
    }

    // === 配置导入导出 ===
    async exportConfig() {
        try {
            this.collectConfigFromUI();
            const configJSON = JSON.stringify(this.config, null, 2);
            
            // 创建下载链接
            const blob = new Blob([configJSON], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `comfyui-config-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.showToast('配置导出成功', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            this.showToast('导出失败: ' + error.message, 'error');
        }
    }

    async importConfig() {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const text = await file.text();
                const importedConfig = JSON.parse(text);
                
                // 合并配置
                this.config = { ...this.getDefaultConfig(), ...importedConfig };
                this.updateUI();
                
                this.showToast('配置导入成功', 'success');
                this.onConfigChange();
            };
            
            input.click();
        } catch (error) {
            console.error('Import failed:', error);
            this.showToast('导入失败: ' + error.message, 'error');
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    getDefaultConfig() {
        return {
            serverUrl: 'http://localhost:8188',
            apiKey: '',
            MODEL_NAME: 'matureRitual_v1211oil.safetensors',
            lora_name: '',
            workflow: 'text2img_basic',
            width: 1024,
            height: 1024,
            steps: 20,
            cfg_scale: 7.0,
            sampler_name: 'euler',
            scheduler: 'normal',
            seed: 156680208700286,
            negative_prompt: 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry'
        };
    }
}

// === 模态框管理器 ===
class ModalManager {
    constructor(parent) {
        this.parent = parent;
        this.currentType = null;
        this.currentData = [];
        this.selectedItem = null;
        
        this.bindModalEvents();
    }

    bindModalEvents() {
        document.getElementById('modalClose').addEventListener('click', () => this.hide());
        document.getElementById('modalCancel').addEventListener('click', () => this.hide());
        document.getElementById('modalConfirm').addEventListener('click', () => this.confirm());
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'modalOverlay') this.hide();
        });
        
        document.getElementById('modalSearch').addEventListener('input', (e) => {
            this.filterItems(e.target.value);
        });
    }

    show(type, data, title) {
        this.currentType = type;
        this.currentData = data;
        this.selectedItem = null;
        
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalSearch').value = '';
        
        this.renderItems(data);
        document.getElementById('modalOverlay').style.display = 'flex';
    }

    hide() {
        document.getElementById('modalOverlay').style.display = 'none';
        this.currentType = null;
        this.currentData = [];
        this.selectedItem = null;
    }

    renderItems(items) {
        const list = document.getElementById('modalList');
        list.innerHTML = '';
        
        if (items.length === 0) {
            list.innerHTML = '<div class="empty-state">没有找到相关项目</div>';
            return;
        }
        
        items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'model-item';
            div.onclick = () => this.selectItem(item, div);
            
            div.innerHTML = `
                <input type="radio" name="modalSelection" value="${index}">
                <div>
                    <div class="model-name">${item.name || item}</div>
                    ${item.size ? `<div class="model-info">大小: ${item.size}</div>` : ''}
                </div>
            `;
            
            list.appendChild(div);
        });
    }

    selectItem(item, element) {
        // 清除之前的选中状态
        document.querySelectorAll('.model-item').forEach(el => {
            el.classList.remove('selected');
        });
        
        // 设置新的选中状态
        element.classList.add('selected');
        element.querySelector('input[type="radio"]').checked = true;
        this.selectedItem = item;
    }

    filterItems(query) {
        const filtered = this.currentData.filter(item => {
            const name = (item.name || item).toLowerCase();
            return name.includes(query.toLowerCase());
        });
        
        this.renderItems(filtered);
    }

    confirm() {
        if (!this.selectedItem) {
            this.parent.showToast('请选择一个项目', 'warning');
            return;
        }
        
        const itemName = this.selectedItem.name || this.selectedItem;
        
        if (this.currentType === 'models') {
            document.getElementById('modelName').value = itemName;
        } else if (this.currentType === 'loras') {
            document.getElementById('loraName').value = itemName;
        }
        
        this.parent.onConfigChange();
        this.hide();
        this.parent.showToast(`已选择: ${itemName}`, 'success');
    }
}

// === 模块初始化 ===
document.addEventListener('DOMContentLoaded', () => {
    window.comfyUISettings = new ComfyUISettingsModule();
});