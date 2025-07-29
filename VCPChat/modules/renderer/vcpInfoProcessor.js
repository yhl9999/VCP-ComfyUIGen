// modules/renderer/vcpInfoProcessor.js
// VCP工具信息处理器 - 直接提取和渲染VCP工具调用信息

import { extractAIStyleInfo } from './codeWrapperCleaner.js';

/**
 * VCP工具信息处理器
 * 专门负责处理VCP工具调用信息的提取和渲染
 * 职责单一：只处理VCP相关信息，不涉及其他代码清理
 */

/**
 * 处理ComfyUI专门的内容过滤
 * @param {string} content - 原始返回内容
 * @returns {string} - 过滤后的简化内容
 */
function processComfyUIContent(content) {
    try {
        // 提取图片数量信息
        const imageCountMatch = content.match(/共生成\s*(\d+)\s*张图片/);
        const imageCount = imageCountMatch ? imageCountMatch[1] : '1';
        
        // 构建简化的状态监控内容（只显示状态，不显示图片）
        const simplifiedContent = `图片生成成功！共生成 ${imageCount} 张图片`;
        
        return simplifiedContent;
    } catch (error) {
        console.warn('[VCPInfoProcessor] 处理ComfyUI内容时出错:', error);
        return content; // 出错时返回原内容
    }
}

/**
 * 解析VCP调用结果信息内容
 * @param {string} content - VCP信息块的内容
 * @returns {Object} - 解析后的VCP信息
 */
function parseVcpInfo(content) {
    const vcpInfo = {
        toolName: '未知工具',
        status: 'unknown',
        returnContent: '',
        originalContent: content
    };
    
    try {
        const toolNameMatch = content.match(/工具名称:\s*([^\n\r]*)/);
        if (toolNameMatch) {
            vcpInfo.toolName = toolNameMatch[1].trim();
        }
        
        const statusMatch = content.match(/执行状态:\s*([^\n\r]*)/);
        if (statusMatch) {
            const statusLine = statusMatch[1].trim();
            if (statusLine.includes('✅') || statusLine.includes('SUCCESS')) {
                vcpInfo.status = 'success';
            } else if (statusLine.includes('❌') || statusLine.includes('ERROR')) {
                vcpInfo.status = 'error';
            } else {
                vcpInfo.status = 'unknown';
            }
        }
        
        const contentMatch = content.match(/返回内容:\s*([\s\S]*)/);
        if (contentMatch) {
            const rawContent = contentMatch[1].trim();
            
            // 如果是ComfyUI工具，使用专门的过滤函数
            if (vcpInfo.toolName === 'ComfyUIGen') {
                vcpInfo.returnContent = processComfyUIContent(rawContent);
            } else {
                vcpInfo.returnContent = rawContent;
            }
        }
        
    } catch (error) {
        console.warn('[VCPInfoProcessor] 解析VCP信息时出错:', error);
    }
    
    return vcpInfo;
}

/**
 * 生成工具状态HTML
 * @param {Object} vcpInfo - VCP信息对象
 * @param {Object} aiStyles - 从AI消息中提取的样式信息（可选）
 * @returns {string} - 生成的HTML
 */
function generateToolStatusHtml(vcpInfo, aiStyles = null) {
    // 工具名称映射
    const toolNameMap = {
        'ChromeControl': '浏览器控制',
        'FileOperator': '文件操作',
        'TavilySearch': '网络搜索',
        'SciCalculator': '科学计算',
        'FluxGen': '图片生成',
        'SunoGen': '音乐生成',
        'VideoGenerator': '视频生成',
        'AgentAssistant': 'Agent通讯',
        'AgentMessage': '主人通讯',
        'DeepMemo': '深度回忆',
        'ComfyUIGen': 'ComfyUI生图'
    };
    
    // 工具图标映射
    const toolIconMap = {
        'ChromeControl': '🌐',
        'FileOperator': '📁',
        'TavilySearch': '🔍',
        'SciCalculator': '🧮',
        'FluxGen': '🎨',
        'SunoGen': '🎵',
        'VideoGenerator': '🎬',
        'AgentAssistant': '🤖',
        'AgentMessage': '💬',
        'DeepMemo': '🧠',
        'ComfyUIGen': '🖼️'
    };
    
    const displayName = toolNameMap[vcpInfo.toolName] || vcpInfo.toolName;
    const icon = toolIconMap[vcpInfo.toolName] || '🔧';
    
    // 使用AI样式信息或默认样式
    const styles = aiStyles || {
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
    
    // 根据状态设置样式
    let statusConfig;
    switch (vcpInfo.status) {
        case 'success':
            statusConfig = {
                background: styles.background.success || 'linear-gradient(135deg, #f0fff4, #e6ffed)',
                border: '#b3dfb3',
                statusText: '已完成',
                statusColor: '#28a745',
                statusBg: '#d4edda'
            };
            break;
        case 'error':
            statusConfig = {
                background: styles.background.error || 'linear-gradient(135deg, #fff5f5, #fed7d7)',
                border: '#ffb3b3',
                statusText: '执行失败',
                statusColor: '#dc3545',
                statusBg: '#f8d7da'
            };
            break;
        default:
            statusConfig = {
                background: styles.background.executing || 'linear-gradient(135deg, #f0f8ff, #e6f3ff)',
                border: '#b3d9ff',
                statusText: '执行中',
                statusColor: '#666',
                statusBg: '#fff'
            };
    }
    
    return `
<div class="vcp-tool-status" style="
    background: ${statusConfig.background};
    border: 1px solid ${statusConfig.border};
    border-radius: ${styles.borderRadius};
    padding: ${styles.padding};
    margin: ${styles.margin};
    font-family: ${styles.fontFamily};
    font-size: 14px;
    color: #263238;
    box-shadow: ${styles.boxShadow};
    max-width: ${styles.maxWidth};
">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: ${vcpInfo.returnContent ? '10px' : '0'};">
        <span style="font-size: 18px;">${icon}</span>
        <span style="font-weight: 600; color: ${statusConfig.statusColor}; flex: 1;">${displayName}</span>
        <span style="font-size: 12px; color: ${statusConfig.statusColor}; background: ${statusConfig.statusBg}; padding: 4px 8px; border-radius: 10px; font-weight: 500;">${statusConfig.statusText}</span>
    </div>
    ${vcpInfo.returnContent ? `<div style="margin-top: 8px; font-size: 14px; color: #495057; background: rgba(255,255,255,0.8); padding: 12px; border-radius: 8px; border-left: 4px solid ${statusConfig.statusColor}; line-height: 1.5;">${vcpInfo.returnContent}</div>` : ''}
</div>`.trim();
}

/**
 * 提取并渲染所有VCP工具信息
 * @param {string} text - 输入文本
 * @returns {Object} - 处理结果 { processedText, extractedInfos }
 */
function extractAndRenderVcpInfos(text) {
    // 首先提取AI消息中的样式信息
    const aiStyles = extractAIStyleInfo(text);
    
    // 支持的VCP信息格式
    const vcpInfoRegex = /\[\[VCP调用结果信息汇总:([\s\S]*?)\]\]/gi;
    const vcpInfoRegexAlt = /\[\[VCP调用结果信息:([\s\S]*?)\]\]/gi;
    
    let processedText = text;
    let extractedInfos = [];
    let match;
    
    // 收集所有VCP信息块（按出现顺序倒序处理，避免位置偏移）
    let vcpBlocks = [];
    
    // 主格式
    vcpInfoRegex.lastIndex = 0;
    while ((match = vcpInfoRegex.exec(text)) !== null) {
        vcpBlocks.push({
            fullMatch: match[0],
            content: match[1].trim(),
            index: match.index
        });
    }
    
    // 替代格式
    vcpInfoRegexAlt.lastIndex = 0;
    while ((match = vcpInfoRegexAlt.exec(text)) !== null) {
        vcpBlocks.push({
            fullMatch: match[0],
            content: match[1].trim(),
            index: match.index
        });
    }
    
    // 按索引倒序排列，避免替换时位置偏移
    vcpBlocks.sort((a, b) => b.index - a.index);
    
    // 处理每个VCP信息块
    vcpBlocks.forEach(block => {
        const vcpInfo = parseVcpInfo(block.content);
        // 传入AI样式信息
        const statusHtml = generateToolStatusHtml(vcpInfo, aiStyles);
        
        // 替换原始块为渲染的HTML
        processedText = processedText.replace(block.fullMatch, statusHtml);
        
        extractedInfos.push(vcpInfo);
    });
    
    return {
        processedText,
        extractedInfos,
        hasVcpInfo: vcpBlocks.length > 0
    };
}

/**
 * 清理工具调用标识符（简单直接）
 * @param {string} text - 输入文本
 * @returns {string} - 清理后的文本
 */
function cleanToolRequestBlocks(text) {
    let cleaned = text;
    
    // 移除工具调用块
    cleaned = cleaned.replace(/<<<\[TOOL_REQUEST\]>>>([\s\S]*?)<<<\[END_TOOL_REQUEST\]>>>/gi, '');
    
    // 移除VCP结果块
    cleaned = cleaned.replace(/<<<\[VCP_RESULT\]>>>([\s\S]*?)<<<\[END_VCP_RESULT\]>>>/gi, '');
    
    return cleaned;
}

/**
 * 主处理函数 - 完整的VCP信息处理流程
 * @param {string} text - 输入文本
 * @returns {Object} - 处理结果
 */
function processVcpInfo(text) {
    // 1. 首先清理旧格式的工具调用标识符
    let processedText = cleanToolRequestBlocks(text);
    
    // 2. 提取并渲染VCP调用结果信息
    const result = extractAndRenderVcpInfos(processedText);
    
    return {
        processedText: result.processedText,
        extractedInfos: result.extractedInfos,
        hasVcpInfo: result.hasVcpInfo,
        originalText: text
    };
}

export {
    processComfyUIContent,
    parseVcpInfo,
    generateToolStatusHtml,
    extractAndRenderVcpInfos,
    cleanToolRequestBlocks,
    processVcpInfo
};