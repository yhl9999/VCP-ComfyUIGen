// modules/renderer/codeWrapperCleaner.js
// VCP项目专用：清理AI回复中的代码包裹符号

/**
 * VCP代码包裹符号清理器
 * 专门移除AI回复中错误出现的 ```html 等包裹符号，保留内容
 * 
 * 设计原则：
 * 1. 简单直接：只移除包裹符号，保留所有内容
 * 2. 安全可靠：出错时返回原始内容
 * 3. 职责单一：只处理代码包裹，不处理VCP工具信息
 * 
 * 支持的清理模式：
 * - safe: 安全模式，只处理HTML/XML
 * - standard: 标准模式，处理常见包裹
 * - aggressive: 激进模式，移除所有可能的包裹
 */

/**
 * 移除代码包裹符号，保留内容
 * @param {string} text - 输入文本
 * @param {Object} options - 清理选项
 * @returns {string} - 处理后的文本
 */
function removeCodeWrappers(text, options = {}) {
    if (typeof text !== 'string') return text;
    
    const { 
        removeHtml = true,
        removeXml = true, 
        removeMarkdown = true,
        removeGeneric = false,  // 默认不移除无语言标识的包裹
        logChanges = false 
    } = options;
    
    let processedText = text;
    let changesCount = 0;
    
    // 移除 ```html 包裹（增强版，处理多种情况）
    if (removeHtml) {
        // 处理标准格式：```html\n内容\n```
        processedText = processedText.replace(/```html\s*\n?([\s\S]*?)\n?```/gi, (match, content) => {
            changesCount++;
            if (logChanges) {
                console.log('[CodeWrapperCleaner] 移除HTML包裹 (标准格式)');
            }
            return content.trim();
        });
        
        // 处理行内格式：```html 内容 ```
        processedText = processedText.replace(/```html\s+([\s\S]*?)\s+```/gi, (match, content) => {
            changesCount++;
            if (logChanges) {
                console.log('[CodeWrapperCleaner] 移除HTML包裹 (行内格式)');
            }
            return content.trim();
        });
        
        // 处理不完整格式：```html 内容（没有结尾标识符）
        processedText = processedText.replace(/```html\s*\n?([\s\S]*?)(?=```|\Z)/gi, (match, content) => {
            // 确保这不是一个完整的代码块（避免重复处理）
            if (!match.endsWith('```')) {
                changesCount++;
                if (logChanges) {
                    console.log('[CodeWrapperCleaner] 移除HTML包裹 (不完整格式)');
                }
                return content.trim();
            }
            return match; // 保持原样，让其他规则处理
        });
    }
    
    // 移除 ```xml 包裹
    if (removeXml) {
        processedText = processedText.replace(/```xml\s*\n?([\s\S]*?)\n?```/gi, (match, content) => {
            changesCount++;
            if (logChanges) {
                console.log('[CodeWrapperCleaner] 移除XML包裹');
            }
            return content.trim();
        });
    }
    
    // 移除 ```markdown 包裹
    if (removeMarkdown) {
        processedText = processedText.replace(/```markdown\s*\n?([\s\S]*?)\n?```/gi, (match, content) => {
            changesCount++;
            if (logChanges) {
                console.log('[CodeWrapperCleaner] 移除Markdown包裹');
            }
            return content.trim();
        });
    }
    
    // 移除无语言标识的包裹（更激进的选项）
    if (removeGeneric) {
        processedText = processedText.replace(/^```\s*\n?([\s\S]*?)\n?```$/gm, (match, content) => {
            // 简单检查：如果内容包含HTML标签，可能是要渲染的内容
            if (/<[^>]+>/.test(content)) {
                changesCount++;
                if (logChanges) {
                    console.log('[CodeWrapperCleaner] 移除无语言标识包裹');
                }
                return content.trim();
            }
            return match; // 保留原始包裹
        });
    }
    
    if (logChanges && changesCount > 0) {
        console.log(`[CodeWrapperCleaner] 总共移除了 ${changesCount} 个代码包裹`);
    }
    
    return processedText;
}

/**
 * 从AI消息中提取样式信息
 * @param {string} text - 完整的消息文本
 * @returns {Object} - 提取的样式信息
 */
function extractAIStyleInfo(text) {
    const defaultStyles = {
        borderRadius: '15px',
        padding: '20px',
        margin: '10px 0',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        fontFamily: "'Segoe UI', sans-serif",
        maxWidth: '600px',
        background: {
            success: 'linear-gradient(135deg, #e0f7fa, #b2ebf2)',
            error: 'linear-gradient(135deg, #fce4ec, #f8bbd0)',
            executing: 'linear-gradient(135deg, #f0f8ff, #e6f3ff)'
        }
    };

    try {
        // 查找AI生成的div样式
        const divStyleRegex = /<div\s+style="([^"]*)"[^>]*>/gi;
        let match;
        let extractedStyles = {};

        while ((match = divStyleRegex.exec(text)) !== null) {
            const styleString = match[1];
            
            // 解析样式字符串
            const styles = {};
            styleString.split(';').forEach(rule => {
                if (rule.trim()) {
                    const [property, value] = rule.split(':').map(s => s.trim());
                    if (property && value) {
                        styles[property] = value;
                    }
                }
            });

            // 提取关键样式属性
            if (styles['border-radius']) {
                extractedStyles.borderRadius = styles['border-radius'];
            }
            if (styles['padding']) {
                extractedStyles.padding = styles['padding'];
            }
            if (styles['margin']) {
                extractedStyles.margin = styles['margin'];
            }
            if (styles['box-shadow']) {
                extractedStyles.boxShadow = styles['box-shadow'];
            }
            if (styles['font-family']) {
                extractedStyles.fontFamily = styles['font-family'];
            }
            if (styles['max-width']) {
                extractedStyles.maxWidth = styles['max-width'];
            }
            if (styles['background']) {
                // 根据背景色判断状态类型
                const bgValue = styles['background'];
                if (bgValue.includes('#e0f7fa') || bgValue.includes('#b2ebf2')) {
                    extractedStyles.background = { ...defaultStyles.background, success: bgValue };
                } else if (bgValue.includes('#fce4ec') || bgValue.includes('#f8bbd0')) {
                    extractedStyles.background = { ...defaultStyles.background, error: bgValue };
                } else if (bgValue.includes('#f0f8ff') || bgValue.includes('#e6f3ff')) {
                    extractedStyles.background = { ...defaultStyles.background, executing: bgValue };
                }
            }
        }

        // 合并提取的样式和默认样式
        return {
            borderRadius: extractedStyles.borderRadius || defaultStyles.borderRadius,
            padding: extractedStyles.padding || defaultStyles.padding,
            margin: extractedStyles.margin || defaultStyles.margin,
            boxShadow: extractedStyles.boxShadow || defaultStyles.boxShadow,
            fontFamily: extractedStyles.fontFamily || defaultStyles.fontFamily,
            maxWidth: extractedStyles.maxWidth || defaultStyles.maxWidth,
            background: extractedStyles.background || defaultStyles.background
        };
    } catch (error) {
        console.warn('[CodeWrapperCleaner] 样式提取失败，使用默认样式:', error);
        return defaultStyles;
    }
}

/**
 * 主清理函数 - 对外接口
 * @param {string} messageContent - 消息内容
 * @param {string} mode - 清理模式: 'safe', 'standard', 'aggressive'
 * @returns {string} - 清理后的内容
 */
function cleanCodeWrappers(messageContent, mode = 'standard') {
    // 增强的输入验证
    if (messageContent === null || messageContent === undefined) {
        return messageContent;
    }
    
    if (typeof messageContent !== 'string') {
        console.warn('[CodeWrapperCleaner] 非字符串输入:', typeof messageContent, messageContent);
        return messageContent;
    }
    
    // 空字符串直接返回
    if (messageContent === '') {
        return messageContent;
    }
    
    const modes = {
        // 安全模式：只移除明确的HTML/XML包裹
        safe: { 
            removeHtml: true, 
            removeXml: true, 
            removeMarkdown: false, 
            removeGeneric: false,
            logChanges: false 
        },
        // 标准模式：移除常见的包裹类型
        standard: { 
            removeHtml: true, 
            removeXml: true, 
            removeMarkdown: true, 
            removeGeneric: false,
            logChanges: true
        },
        // 激进模式：移除所有可能的包裹
        aggressive: { 
            removeHtml: true, 
            removeXml: true, 
            removeMarkdown: true, 
            removeGeneric: true,
            logChanges: false 
        }
    };
    
    const options = modes[mode] || modes.standard;
    
    try {
        const result = removeCodeWrappers(messageContent, options);
        return result;
    } catch (error) {
        console.error('[CodeWrapperCleaner] 清理过程出错:', error);
        // 出错时返回原始内容，确保不会破坏消息
        return messageContent;
    }
}

/**
 * 测试函数 - 用于验证清理逻辑
 */
function runTests() {
    const testCases = [
        {
            name: '移除HTML包裹（标准格式）',
            input: '```html\n<div class="test">Hello World</div>\n```',
            expected: '<div class="test">Hello World</div>'
        },
        {
            name: '移除HTML包裹（实际案例）',
            input: '```html\n<div style="background: linear-gradient(135deg, #e0f7fa, #b2ebf2);">内容</div>\n```',
            expected: '<div style="background: linear-gradient(135deg, #e0f7fa, #b2ebf2);">内容</div>'
        },
        {
            name: '移除XML包裹',
            input: '```xml\n<note><to>Tove</to><body>Hello</body></note>\n```',
            expected: '<note><to>Tove</to><body>Hello</body></note>'
        },
        {
            name: '移除Markdown包裹',
            input: '```markdown\n# 这是标题\n\n内容\n```',
            expected: '# 这是标题\n\n内容'
        },
        {
            name: '保留代码包裹（JavaScript）',
            input: '```javascript\nfunction test() { return "hello"; }\n```',
            expected: '```javascript\nfunction test() { return "hello"; }\n```'
        },
        {
            name: '处理多个包裹',
            input: '```html\n<div>HTML内容</div>\n```\n\n```javascript\nconst x = 1;\n```\n\n```xml\n<root>XML内容</root>\n```',
            expected: '<div>HTML内容</div>\n\n```javascript\nconst x = 1;\n```\n\n<root>XML内容</root>'
        }
    ];
    
    console.log('[CodeWrapperCleaner] 运行测试...');
    
    testCases.forEach(({ name, input, expected }) => {
        const result = cleanCodeWrappers(input, 'standard');
        const passed = result === expected;
        
        console.log(`${passed ? '✅' : '❌'} ${name}`);
        if (!passed) {
            console.log('  期望:', expected);
            console.log('  实际:', result);
        }
    });
}

// 导出函数
export {
    cleanCodeWrappers,
    removeCodeWrappers,
    extractAIStyleInfo,
    runTests
};

// 如果直接运行此脚本，执行测试
if (typeof window !== 'undefined' && window.location.href.includes('test')) {
    runTests();
}