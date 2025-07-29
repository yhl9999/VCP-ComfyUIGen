#!/usr/bin/env node

/**
 * ComfyUI 工作流占位符处理模块
 * 用于提取、替换和管理工作流中的 %...% 占位符
 */

class PlaceholderProcessor {
    constructor() {
        // 预定义的占位符类型和默认值
        this.defaultConfig = {
            // Agent生成类占位符 - 由AI动态生成
            agentGenerated: {
                'prompt': '',
                'negative_prompt': 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry'
            },
            
            // 用户配置类占位符 - 需要前端设置
            userConfigurable: {
                'seed': 156680208700286,
                'steps': 20,
                'cfg_scale': 7,
                'sampler_name': 'euler',
                'scheduler': 'normal',
                'width': 1024,
                'height': 1024,
                'MODEL_NAME': 'v1-5-pruned-emaonly.ckpt',
                'denoise': 1,
                'batch_size': 1
            }
        };
    }

    /**
     * 从工作流JSON中提取所有占位符
     * @param {Object} workflow - ComfyUI工作流对象
     * @returns {Object} 提取的占位符信息
     */
    extractPlaceholders(workflow) {
        const placeholders = new Set();
        const placeholderInfo = {
            agentGenerated: [],
            userConfigurable: [],
            unknown: []
        };

        // 递归遍历对象提取占位符
        const extractFromValue = (value, path = '') => {
            if (typeof value === 'string') {
                const matches = value.match(/%([^%]+)%/g);
                if (matches) {
                    matches.forEach(match => {
                        const key = match.slice(1, -1); // 移除 % 符号
                        placeholders.add(key);
                        
                        // 分类占位符
                        if (this.defaultConfig.agentGenerated.hasOwnProperty(key)) {
                            placeholderInfo.agentGenerated.push({
                                key,
                                path,
                                match,
                                defaultValue: this.defaultConfig.agentGenerated[key]
                            });
                        } else if (this.defaultConfig.userConfigurable.hasOwnProperty(key)) {
                            placeholderInfo.userConfigurable.push({
                                key,
                                path,
                                match,
                                defaultValue: this.defaultConfig.userConfigurable[key]
                            });
                        } else {
                            placeholderInfo.unknown.push({
                                key,
                                path,
                                match,
                                defaultValue: null
                            });
                        }
                    });
                }
            } else if (typeof value === 'object' && value !== null) {
                for (const [key, val] of Object.entries(value)) {
                    extractFromValue(val, path ? `${path}.${key}` : key);
                }
            }
        };

        extractFromValue(workflow);

        return {
            total: placeholders.size,
            placeholders: Array.from(placeholders),
            categorized: placeholderInfo
        };
    }

    /**
     * 替换工作流中的占位符
     * @param {Object} workflow - 原始工作流对象
     * @param {Object} values - 要替换的值 {placeholder_key: value}
     * @returns {Object} 替换后的工作流对象
     */
    replacePlaceholders(workflow, values) {
        // 深拷贝工作流以避免修改原对象
        const processedWorkflow = JSON.parse(JSON.stringify(workflow));

        // 递归替换占位符
        const replaceInValue = (obj) => {
            if (typeof obj === 'string') {
                let result = obj;
                for (const [key, value] of Object.entries(values)) {
                    const placeholder = `%${key}%`;
                    if (result.includes(placeholder)) {
                        result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value));
                    }
                }
                return result;
            } else if (typeof obj === 'object' && obj !== null) {
                for (const [key, val] of Object.entries(obj)) {
                    obj[key] = replaceInValue(val);
                }
            }
            return obj;
        };

        return replaceInValue(processedWorkflow);
    }

    /**
     * 验证占位符值的类型和有效性
     * @param {string} key - 占位符键名
     * @param {*} value - 要验证的值
     * @returns {Object} 验证结果
     */
    validatePlaceholderValue(key, value) {
        const validationRules = {
            'seed': (v) => Number.isInteger(Number(v)) && Number(v) >= 0,
            'steps': (v) => Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) <= 150,
            'cfg_scale': (v) => !isNaN(Number(v)) && Number(v) > 0 && Number(v) <= 30,
            'width': (v) => Number.isInteger(Number(v)) && Number(v) >= 64 && Number(v) <= 4096,
            'height': (v) => Number.isInteger(Number(v)) && Number(v) >= 64 && Number(v) <= 4096,
            'sampler_name': (v) => typeof v === 'string' && v.length > 0,
            'scheduler': (v) => typeof v === 'string' && v.length > 0,
            'MODEL_NAME': (v) => typeof v === 'string' && v.length > 0,
            'prompt': (v) => typeof v === 'string' && v.trim().length > 0,
            'negative_prompt': (v) => typeof v === 'string',
            'denoise': (v) => !isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 1,
            'batch_size': (v) => Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) <= 10
        };

        const rule = validationRules[key];
        if (!rule) {
            return { valid: true, message: 'No validation rule defined' };
        }

        const isValid = rule(value);
        return {
            valid: isValid,
            message: isValid ? 'Valid' : `Invalid value for ${key}: ${value}`
        };
    }

    /**
     * 获取配置模板（用于前端配置界面）
     * @returns {Object} 配置模板
     */
    getConfigTemplate() {
        return {
            agentGenerated: {
                title: "AI生成参数",
                description: "这些参数由Agent自动生成，无需手动配置",
                fields: Object.keys(this.defaultConfig.agentGenerated).map(key => ({
                    key,
                    type: 'text',
                    readonly: true,
                    defaultValue: this.defaultConfig.agentGenerated[key],
                    description: this.getFieldDescription(key)
                }))
            },
            userConfigurable: {
                title: "用户配置参数",
                description: "这些参数可以通过前端界面进行配置",
                fields: Object.keys(this.defaultConfig.userConfigurable).map(key => ({
                    key,
                    type: this.getFieldType(key),
                    readonly: false,
                    defaultValue: this.defaultConfig.userConfigurable[key],
                    description: this.getFieldDescription(key),
                    validation: this.getFieldValidation(key)
                }))
            }
        };
    }

    /**
     * 获取字段类型（用于前端表单）
     */
    getFieldType(key) {
        const typeMap = {
            'seed': 'number',
            'steps': 'number',
            'cfg_scale': 'number',
            'width': 'number',
            'height': 'number',
            'denoise': 'number',
            'batch_size': 'number',
            'sampler_name': 'select',
            'scheduler': 'select',
            'MODEL_NAME': 'select',
            'prompt': 'textarea',
            'negative_prompt': 'textarea'
        };
        return typeMap[key] || 'text';
    }

    /**
     * 获取字段描述
     */
    getFieldDescription(key) {
        const descriptions = {
            'prompt': '正面提示词，描述你想要生成的图像',
            'negative_prompt': '负面提示词，描述你不想要的元素',
            'seed': '随机种子，控制生成结果的随机性',
            'steps': '采样步数，影响图像质量和生成时间',
            'cfg_scale': 'CFG引导强度，控制模型遵循提示词的程度',
            'sampler_name': '采样器名称，影响生成算法',
            'scheduler': '调度器类型，控制去噪过程',
            'width': '图像宽度（像素）',
            'height': '图像高度（像素）',
            'MODEL_NAME': '使用的模型文件名',
            'denoise': '去噪强度（0-1）',
            'batch_size': '批次大小，一次生成的图像数量'
        };
        return descriptions[key] || '';
    }

    /**
     * 获取字段验证规则
     */
    getFieldValidation(key) {
        const validations = {
            'seed': { min: 0, max: Number.MAX_SAFE_INTEGER },
            'steps': { min: 1, max: 150 },
            'cfg_scale': { min: 0.1, max: 30, step: 0.1 },
            'width': { min: 64, max: 4096, step: 64 },
            'height': { min: 64, max: 4096, step: 64 },
            'denoise': { min: 0, max: 1, step: 0.01 },
            'batch_size': { min: 1, max: 10 }
        };
        return validations[key];
    }

    /**
     * 处理来自API的格式转换
     * @param {Object} apiData - 来自其他API的数据格式
     * @param {string} apiType - API类型 ('automatic1111', 'novelai', 'custom')
     * @returns {Object} 转换后的占位符值
     */
    convertFromApi(apiData, apiType = 'automatic1111') {
        const converters = {
            automatic1111: (data) => ({
                'prompt': data.prompt || '',
                'negative_prompt': data.negative_prompt || '',
                'seed': data.seed || -1,
                'steps': data.steps || 20,
                'cfg_scale': data.cfg_scale || 7,
                'sampler_name': this.mapSampler(data.sampler_name || data.sampler_index),
                'width': data.width || 512,
                'height': data.height || 512
            }),
            novelai: (data) => ({
                'prompt': data.input || '',
                'negative_prompt': data.uc || '',
                'seed': data.seed || -1,
                'steps': data.steps || 28,
                'cfg_scale': data.scale || 11,
                'width': data.width || 512,
                'height': data.height || 512
            }),
            custom: (data) => data // 直接使用自定义格式
        };

        const converter = converters[apiType];
        if (!converter) {
            throw new Error(`Unsupported API type: ${apiType}`);
        }

        return converter(apiData);
    }

    /**
     * 映射采样器名称
     */
    mapSampler(samplerName) {
        const samplerMap = {
            'Euler': 'euler',
            'Euler a': 'euler_ancestral',
            'DPM++ 2M': 'dpmpp_2m',
            'DPM++ SDE': 'dpmpp_sde',
            'DDIM': 'ddim',
            'LMS': 'lms'
        };
        return samplerMap[samplerName] || 'euler';
    }
}

module.exports = PlaceholderProcessor;