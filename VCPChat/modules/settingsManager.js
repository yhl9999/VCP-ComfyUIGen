/**
 * settingsManager.js
 * 
 * Manages the settings panel for both Agents and Groups.
 * Handles displaying, populating, saving, and deleting items.
 */
const settingsManager = (() => {
    /**
     * Completes a VCP Server URL to the full completions endpoint.
     * @param {string} url - The URL to complete.
     * @returns {string} The completed URL.
     */
    function completeVcpUrl(url) {
        if (!url) return '';
        let trimmedUrl = url.trim();
        if (trimmedUrl === '') return '';

        // If it doesn't have a protocol, add http://
        if (!/^https?:\/\//i.test(trimmedUrl)) {
            trimmedUrl = 'http://' + trimmedUrl;
        }

        try {
            const urlObject = new URL(trimmedUrl);
            const requiredPath = '/v1/chat/completions';

            // For any other case (e.g., root path '/', or some other path),
            // we set the path to the required one.
            urlObject.pathname = requiredPath;
            return urlObject.toString();

        } catch (e) {
            // If URL parsing fails, it's likely an invalid URL.
            // We return the original input for the user to see and correct.
            console.warn(`Could not parse and complete URL: ${url}`, e);
            return url;
        }
    }

    // --- Private Variables ---
    let electronAPI = null;
    let uiHelper = null;
    let refs = {}; // To hold references to currentSelectedItem, etc.
    let mainRendererFunctions = {}; // To call back to renderer.js functions if needed

    // DOM Elements
    let agentSettingsContainer, groupSettingsContainer, selectItemPromptForSettings;
    let itemSettingsContainerTitle, selectedItemNameForSettingsSpan, deleteItemBtn;
    let agentSettingsForm, editingAgentIdInput, agentNameInput, agentAvatarInput, agentAvatarPreview;
    let agentSystemPromptTextarea, agentModelInput, agentTemperatureInput;
    
    // ComfyUI Elements
    let openComfyUIConfigBtn, comfyuiConfigModal, comfyuiConfigForm;
    let comfyuiSeedInput, randomSeedBtn, comfyuiStepsInput, comfyuiCfgScaleInput;
    let comfyuiSamplerNameSelect, comfyuiSchedulerSelect, comfyuiWidthInput, comfyuiHeightInput;
    let comfyuiModelNameInput, loadModelsBtn, comfyuiLoraNameInput, loadLorasBtn;
    let comfyuiNegativePromptTextarea, comfyuiWorkflowSelect, refreshWorkflowsBtn, testComfyUIConnectionBtn;
    let agentContextTokenLimitInput, agentMaxOutputTokensInput, agentTopPInput, agentTopKInput;
    let openModelSelectBtn, modelSelectModal, modelList, modelSearchInput, refreshModelsBtn;
    let agentTtsVoicePrimarySelect, agentTtsRegexPrimaryInput, agentTtsVoiceSecondarySelect, agentTtsRegexSecondaryInput, refreshTtsModelsBtn, agentTtsSpeedSlider, ttsSpeedValueSpan;

    /**
     * Displays the appropriate settings view (agent, group, or default prompt)
     * based on the currently selected item.
     */
    function displaySettingsForItem() {
        const currentSelectedItem = refs.currentSelectedItemRef.get();
        
        const agentSettingsExists = agentSettingsContainer && typeof agentSettingsContainer.style !== 'undefined';
        const groupSettingsExists = groupSettingsContainer && typeof groupSettingsContainer.style !== 'undefined';

        if (currentSelectedItem.id) {
            selectItemPromptForSettings.style.display = 'none';
            selectedItemNameForSettingsSpan.textContent = currentSelectedItem.name || currentSelectedItem.id;

            if (currentSelectedItem.type === 'agent') {
                if (agentSettingsExists) agentSettingsContainer.style.display = 'block';
                if (groupSettingsExists) groupSettingsContainer.style.display = 'none';
                itemSettingsContainerTitle.textContent = 'Agent 设置: ';
                deleteItemBtn.textContent = '删除此 Agent';
                populateAgentSettingsForm(currentSelectedItem.id, currentSelectedItem.config);
            } else if (currentSelectedItem.type === 'group') {
                if (agentSettingsExists) agentSettingsContainer.style.display = 'none';
                if (groupSettingsExists) groupSettingsContainer.style.display = 'block';
                itemSettingsContainerTitle.textContent = '群组设置: ';
                deleteItemBtn.textContent = '删除此群组';
                if (window.GroupRenderer && typeof window.GroupRenderer.displayGroupSettingsPage === 'function') {
                    window.GroupRenderer.displayGroupSettingsPage(currentSelectedItem.id);
                } else {
                    console.error("GroupRenderer or displayGroupSettingsPage not available.");
                    if (groupSettingsExists) groupSettingsContainer.innerHTML = "<p>无法加载群组设置界面。</p>";
                }
            }
        } else {
            if (agentSettingsExists) agentSettingsContainer.style.display = 'none';
            if (groupSettingsExists) groupSettingsContainer.style.display = 'none';
            selectItemPromptForSettings.textContent = '请先在左侧选择一个 Agent 或群组以查看或修改其设置。';
            selectItemPromptForSettings.style.display = 'block';
            itemSettingsContainerTitle.textContent = '设置';
            selectedItemNameForSettingsSpan.textContent = '';
        }
    }

    /**
     * Populates the agent settings form with the config of the selected agent.
     * @param {string} agentId - The ID of the agent.
     * @param {object} agentConfig - The configuration object for the agent.
     */
    async function populateAgentSettingsForm(agentId, agentConfig) {
        if (groupSettingsContainer) groupSettingsContainer.style.display = 'none';
        if (agentSettingsContainer) agentSettingsContainer.style.display = 'block';

        if (!agentConfig || agentConfig.error) {
            uiHelper.showToastNotification(`加载Agent配置失败: ${agentConfig?.error || '未知错误'}`, 'error');
            if (agentSettingsContainer) agentSettingsContainer.style.display = 'none';
            selectItemPromptForSettings.textContent = `加载 ${agentId} 配置失败。`;
            selectItemPromptForSettings.style.display = 'block';
            return;
        }
        
        editingAgentIdInput.value = agentId;
        agentNameInput.value = agentConfig.name || agentId;
        agentSystemPromptTextarea.value = agentConfig.systemPrompt || '';
        agentModelInput.value = agentConfig.model || '';
        agentTemperatureInput.value = agentConfig.temperature !== undefined ? agentConfig.temperature : 0.7;
        agentContextTokenLimitInput.value = agentConfig.contextTokenLimit !== undefined ? agentConfig.contextTokenLimit : 4000;
        agentMaxOutputTokensInput.value = agentConfig.maxOutputTokens !== undefined ? agentConfig.maxOutputTokens : 1000;
        agentTopPInput.value = agentConfig.top_p !== undefined ? agentConfig.top_p : '';
        agentTopKInput.value = agentConfig.top_k !== undefined ? agentConfig.top_k : '';

        const streamOutput = agentConfig.streamOutput !== undefined ? agentConfig.streamOutput : true;
        document.getElementById('agentStreamOutputTrue').checked = streamOutput === true || String(streamOutput) === 'true';
        document.getElementById('agentStreamOutputFalse').checked = streamOutput === false || String(streamOutput) === 'false';
        
        if (agentConfig.avatarUrl) {
            agentAvatarPreview.src = `${agentConfig.avatarUrl}${agentConfig.avatarUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
            agentAvatarPreview.style.display = 'block';
        } else {
            agentAvatarPreview.src = '#';
            agentAvatarPreview.style.display = 'none';
        }
        agentAvatarInput.value = '';
        mainRendererFunctions.setCroppedFile('agent', null);
        
        // Populate bilingual TTS settings
        populateTtsModels(agentConfig.ttsVoicePrimary, agentConfig.ttsVoiceSecondary);
        
        agentTtsRegexPrimaryInput.value = agentConfig.ttsRegexPrimary || '';
        agentTtsRegexSecondaryInput.value = agentConfig.ttsRegexSecondary || '';

        agentTtsSpeedSlider.value = agentConfig.ttsSpeed !== undefined ? agentConfig.ttsSpeed : 1.0;
        ttsSpeedValueSpan.textContent = parseFloat(agentTtsSpeedSlider.value).toFixed(1);
    }

    /**
     * Handles the submission of the agent settings form, saving the changes.
     * @param {Event} event - The form submission event.
     */
    async function saveCurrentAgentSettings(event) {
        event.preventDefault();
        const agentId = editingAgentIdInput.value;
        const newConfig = {
            name: agentNameInput.value.trim(),
            systemPrompt: agentSystemPromptTextarea.value.trim(),
            model: agentModelInput.value.trim() || 'gemini-pro',
            temperature: parseFloat(agentTemperatureInput.value),
            contextTokenLimit: parseInt(agentContextTokenLimitInput.value),
            maxOutputTokens: parseInt(agentMaxOutputTokensInput.value),
            top_p: parseFloat(agentTopPInput.value) || undefined,
            top_k: parseInt(agentTopKInput.value) || undefined,
            streamOutput: document.getElementById('agentStreamOutputTrue').checked,
            ttsVoicePrimary: agentTtsVoicePrimarySelect.value,
            ttsRegexPrimary: agentTtsRegexPrimaryInput.value.trim(),
            ttsVoiceSecondary: agentTtsVoiceSecondarySelect.value,
            ttsRegexSecondary: agentTtsRegexSecondaryInput.value.trim(),
            ttsSpeed: parseFloat(agentTtsSpeedSlider.value)
        };
     
        if (!newConfig.name) {
            uiHelper.showToastNotification("Agent名称不能为空！", 'error');
            return;
        }
     
        const croppedFile = mainRendererFunctions.getCroppedFile('agent');
        if (croppedFile) {
            try {
                const arrayBuffer = await croppedFile.arrayBuffer();
                const avatarResult = await electronAPI.saveAvatar(agentId, {
                    name: croppedFile.name,
                    type: croppedFile.type,
                    buffer: arrayBuffer
                });
     
                if (avatarResult.error) {
                    uiHelper.showToastNotification(`保存Agent头像失败: ${avatarResult.error}`, 'error');
                } else {
                    if (avatarResult.needsColorExtraction && electronAPI.saveAvatarColor) {
                         uiHelper.getAverageColorFromAvatar(avatarResult.avatarUrl, (avgColor) => {
                            if (avgColor) {
                                electronAPI.saveAvatarColor({ type: 'agent', id: agentId, color: avgColor })
                                    .then((saveColorResult) => {
                                        if (saveColorResult && saveColorResult.success) {
                                            if(refs.currentSelectedItemRef.get().id === agentId && refs.currentSelectedItemRef.get().type === 'agent' && window.messageRenderer) {
                                                window.messageRenderer.setCurrentItemAvatarColor(avgColor);
                                            }
                                        } else {
                                            console.warn(`Failed to save agent ${agentId} avatar color:`, saveColorResult?.error);
                                        }
                                    }).catch(err => console.error(`Error saving agent ${agentId} avatar color:`, err));
                            }
                        });
                    }
                    agentAvatarPreview.src = avatarResult.avatarUrl;
                    mainRendererFunctions.setCroppedFile('agent', null);
                    agentAvatarInput.value = '';
                }
            } catch (readError) {
                console.error("读取Agent头像文件失败:", readError);
                uiHelper.showToastNotification(`读取Agent头像文件失败: ${readError.message}`, 'error');
            }
        }
     
        const result = await electronAPI.saveAgentConfig(agentId, newConfig);
        const saveButton = agentSettingsForm.querySelector('button[type="submit"]');
     
        if (result.success) {
            if (saveButton) uiHelper.showSaveFeedback(saveButton, true, '已保存!', '保存 Agent 设置');
            await window.itemListManager.loadItems();
            
            const currentSelectedItem = refs.currentSelectedItemRef.get();
            if (currentSelectedItem.id === agentId && currentSelectedItem.type === 'agent') {
                const updatedAgentConfig = await electronAPI.getAgentConfig(agentId);
                currentSelectedItem.name = newConfig.name;
                currentSelectedItem.config = updatedAgentConfig;
                
                // Update other UI parts via callbacks or direct calls if modules are passed in
                if (mainRendererFunctions.updateChatHeader) {
                    mainRendererFunctions.updateChatHeader(`与 ${newConfig.name} 聊天中`);
                }
                if (window.messageRenderer) {
                    window.messageRenderer.setCurrentItemAvatar(updatedAgentConfig.avatarUrl);
                    window.messageRenderer.setCurrentItemAvatarColor(updatedAgentConfig.avatarCalculatedColor || null);
                }
                selectedItemNameForSettingsSpan.textContent = newConfig.name;
            }
        } else {
            if (saveButton) uiHelper.showSaveFeedback(saveButton, false, '保存失败', '保存 Agent 设置');
            uiHelper.showToastNotification(`保存Agent设置失败: ${result.error}`, 'error');
        }
    }

    /**
     * Handles the deletion of the currently selected item (agent or group).
     */
    async function handleDeleteCurrentItem() {
        const currentSelectedItem = refs.currentSelectedItemRef.get();
        if (!currentSelectedItem.id) {
            uiHelper.showToastNotification("没有选中的项目可删除。", 'info');
            return;
        }

        const itemTypeDisplay = currentSelectedItem.type === 'group' ? '群组' : 'Agent';
        const itemName = currentSelectedItem.name || '当前选中的项目';

        if (confirm(`您确定要删除 ${itemTypeDisplay} "${itemName}" 吗？其所有聊天记录和设置都将被删除，此操作不可撤销！`)) {
            let result;
            if (currentSelectedItem.type === 'agent') {
                result = await electronAPI.deleteAgent(currentSelectedItem.id);
            } else if (currentSelectedItem.type === 'group') {
                result = await electronAPI.deleteAgentGroup(currentSelectedItem.id);
            }

            if (result && result.success) {
                // Reset state in renderer via refs
                refs.currentSelectedItemRef.set({ id: null, type: null, name: null, avatarUrl: null, config: null });
                refs.currentTopicIdRef.set(null);
                refs.currentChatHistoryRef.set([]);
                
                // Call back to renderer to update UI
                if (mainRendererFunctions.onItemDeleted) {
                    mainRendererFunctions.onItemDeleted();
                }
            } else {
                uiHelper.showToastNotification(`删除${itemTypeDisplay}失败: ${result?.error || '未知错误'}`, 'error');
            }
        }
    }

    /**
     * Populates the assistant agent select dropdown with available agents.
     */
    async function populateAssistantAgentSelect() {
        const assistantAgentSelect = document.getElementById('assistantAgent');
        if (!assistantAgentSelect) {
            console.warn('[SettingsManager] populateAssistantAgentSelect: assistantAgentSelect element not found');
            return;
        }

        const agents = await electronAPI.getAgents();
        if (agents && !agents.error) {
            assistantAgentSelect.innerHTML = '<option value="">请选择一个Agent</option>'; // Clear and add placeholder
            agents.forEach(agent => {
                const option = document.createElement('option');
                option.value = agent.id;
                option.textContent = agent.name || agent.id;
                assistantAgentSelect.appendChild(option);
            });
        } else {
            console.error('[SettingsManager] Failed to load agents for assistant select:', agents?.error);
            assistantAgentSelect.innerHTML = '<option value="">加载Agent失败</option>';
        }
    }

    /**
     * Populates the primary and secondary TTS voice model select dropdowns.
     * @param {string} currentPrimaryVoice - The currently selected primary voice.
     * @param {string} currentSecondaryVoice - The currently selected secondary voice.
     */
    async function populateTtsModels(currentPrimaryVoice, currentSecondaryVoice) {
        if (!agentTtsVoicePrimarySelect || !agentTtsVoiceSecondarySelect) return;

        try {
            const models = await electronAPI.sovitsGetModels();
            
            // Clear existing options
            agentTtsVoicePrimarySelect.innerHTML = '<option value="">不使用语音</option>';
            agentTtsVoiceSecondarySelect.innerHTML = '<option value="">不使用</option>';

            if (models && Object.keys(models).length > 0) {
                for (const modelName in models) {
                    // Create options for primary dropdown
                    const primaryOption = document.createElement('option');
                    primaryOption.value = modelName;
                    primaryOption.textContent = modelName;
                    if (modelName === currentPrimaryVoice) {
                        primaryOption.selected = true;
                    }
                    agentTtsVoicePrimarySelect.appendChild(primaryOption);

                    // Create options for secondary dropdown
                    const secondaryOption = document.createElement('option');
                    secondaryOption.value = modelName;
                    secondaryOption.textContent = modelName;
                    if (modelName === currentSecondaryVoice) {
                        secondaryOption.selected = true;
                    }
                    agentTtsVoiceSecondarySelect.appendChild(secondaryOption);
                }
            } else {
                const disabledOption = '<option value="" disabled>未找到模型,请启动Sovits</option>';
                agentTtsVoicePrimarySelect.innerHTML += disabledOption;
                agentTtsVoiceSecondarySelect.innerHTML += disabledOption;
            }
        } catch (error) {
            console.error('Failed to get Sovits TTS models:', error);
            const errorOption = '<option value="" disabled>获取模型失败</option>';
            agentTtsVoicePrimarySelect.innerHTML = errorOption;
            agentTtsVoiceSecondarySelect.innerHTML = errorOption;
            uiHelper.showToastNotification('获取Sovits语音模型失败', 'error');
        }
    }

    /**
     * ComfyUI Configuration Functions
     */

    /**
     * Opens the ComfyUI configuration modal and loads current settings
     */
    async function openComfyUIConfig() {
        try {
            // Load current ComfyUI settings
            const settings = await electronAPI.getSettings();
            const comfyuiSettings = settings.comfyuiConfig || {};
            
            // Populate form with current settings
            populateComfyUIConfigForm(comfyuiSettings);
            
            uiHelper.openModal('comfyuiConfigModal');
        } catch (error) {
            console.error('Failed to load ComfyUI settings:', error);
            uiHelper.showToastNotification('加载ComfyUI配置失败', 'error');
        }
    }

    /**
     * Populates the ComfyUI configuration form with settings
     */
    function populateComfyUIConfigForm(settings) {
        if (comfyuiSeedInput) comfyuiSeedInput.value = settings.seed || 156680208700286;
        if (comfyuiStepsInput) comfyuiStepsInput.value = settings.steps || 20;
        if (comfyuiCfgScaleInput) comfyuiCfgScaleInput.value = settings.cfg_scale || 7;
        if (comfyuiSamplerNameSelect) comfyuiSamplerNameSelect.value = settings.sampler_name || 'euler';
        if (comfyuiSchedulerSelect) comfyuiSchedulerSelect.value = settings.scheduler || 'normal';
        if (comfyuiWidthInput) comfyuiWidthInput.value = settings.width || 1024;
        if (comfyuiHeightInput) comfyuiHeightInput.value = settings.height || 1024;
        if (comfyuiModelNameInput) comfyuiModelNameInput.value = settings.MODEL_NAME || 'v1-5-pruned-emaonly.ckpt';
        if (comfyuiLoraNameInput) comfyuiLoraNameInput.value = settings.lora_name || '';
        if (comfyuiWorkflowSelect) comfyuiWorkflowSelect.value = settings.workflow || 'text2img_basic';
        if (comfyuiNegativePromptTextarea) comfyuiNegativePromptTextarea.value = settings.negative_prompt || '';
    }

    /**
     * Saves ComfyUI configuration
     */
    async function saveComfyUIConfig(event) {
        event.preventDefault();
        
        const config = {
            seed: parseInt(comfyuiSeedInput.value) || 156680208700286,
            steps: parseInt(comfyuiStepsInput.value) || 20,
            cfg_scale: parseFloat(comfyuiCfgScaleInput.value) || 7,
            sampler_name: comfyuiSamplerNameSelect.value || 'euler',
            scheduler: comfyuiSchedulerSelect.value || 'normal',
            width: parseInt(comfyuiWidthInput.value) || 1024,
            height: parseInt(comfyuiHeightInput.value) || 1024,
            MODEL_NAME: comfyuiModelNameInput.value || 'v1-5-pruned-emaonly.ckpt',
            lora_name: comfyuiLoraNameInput.value || '',
            workflow: comfyuiWorkflowSelect.value || 'text2img_basic',
            negative_prompt: comfyuiNegativePromptTextarea.value || ''
        };

        try {
            const result = await electronAPI.saveComfyUIConfig(config);
            if (result.success) {
                uiHelper.showToastNotification('ComfyUI配置已保存', 'success');
                uiHelper.closeModal('comfyuiConfigModal');
                // Clear cache to force refresh next time models are loaded
                comfyuiModelsCache = null;
            } else {
                uiHelper.showToastNotification(`保存失败: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Failed to save ComfyUI config:', error);
            uiHelper.showToastNotification('保存ComfyUI配置失败', 'error');
        }
    }

    /**
     * Generates a random seed
     */
    function generateRandomSeed() {
        const randomSeed = Math.floor(Math.random() * 9223372036854775807);
        if (comfyuiSeedInput) {
            comfyuiSeedInput.value = randomSeed;
        }
    }

    /**
     * Tests connection to ComfyUI server
     */
    async function testComfyUIConnection() {
        try {
            const result = await electronAPI.testComfyUIConnection();
            if (result.success) {
                uiHelper.showToastNotification('ComfyUI连接成功', 'success');
            } else {
                uiHelper.showToastNotification(`连接失败: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Failed to test ComfyUI connection:', error);
            uiHelper.showToastNotification('测试连接失败', 'error');
        }
    }

    // Cache for ComfyUI models and LoRAs data to avoid redundant backend calls
    let comfyuiModelsCache = null;
    
    /**
     * Refreshes the available workflows list
     */
    async function refreshWorkflowsList() {
        try {
            const result = await electronAPI.getComfyUIWorkflows();
            if (result.success && result.workflows) {
                // Clear existing options
                comfyuiWorkflowSelect.innerHTML = '';
                
                // Add default options
                const defaultOptions = [
                    { value: 'text2img_basic', text: '基础文生图' },
                    { value: 'text2img_advanced', text: '高级文生图' },
                    { value: 'text2img_lora', text: '文生图 + LoRA' },
                    { value: 'custom', text: '自定义' }
                ];
                
                defaultOptions.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.text;
                    comfyuiWorkflowSelect.appendChild(option);
                });
                
                // Add discovered workflows
                result.workflows.forEach(workflow => {
                    const option = document.createElement('option');
                    option.value = workflow.id;
                    option.textContent = workflow.name || workflow.id;
                    comfyuiWorkflowSelect.appendChild(option);
                });
                
                uiHelper.showToastNotification(`已发现 ${result.workflows.length} 个工作流`, 'success');
            } else {
                uiHelper.showToastNotification('刷新工作流列表失败', 'error');
            }
        } catch (error) {
            console.error('Failed to refresh workflows:', error);
            uiHelper.showToastNotification('刷新工作流列表失败', 'error');
        }
    }
    
    /**
     * Loads available models and LoRAs from ComfyUI server (cached)
     */
    async function loadComfyUIData(forceRefresh = false) {
        if (comfyuiModelsCache && !forceRefresh) {
            return comfyuiModelsCache;
        }
        
        try {
            const result = await electronAPI.getComfyUIModels();
            if (result.success) {
                comfyuiModelsCache = result;
                return result;
            } else {
                throw new Error(result.error || '未知错误');
            }
        } catch (error) {
            console.error('Failed to load ComfyUI data:', error);
            throw error;
        }
    }

    /**
     * Loads available models from ComfyUI server
     */
    async function loadComfyUIModels() {
        try {
            const result = await loadComfyUIData();
            if (result.models && result.models.length > 0) {
                showComfyUIModelSelectionDialog(result.models, 'model');
            } else {
                uiHelper.showToastNotification('未找到可用模型', 'warning');
            }
        } catch (error) {
            uiHelper.showToastNotification(`获取模型列表失败: ${error.message}`, 'error');
        }
    }

    /**
     * Loads available LoRA models from ComfyUI server
     */
    async function loadComfyUILoras() {
        try {
            const result = await loadComfyUIData();
            if (result.loras && result.loras.length > 0) {
                showComfyUIModelSelectionDialog(result.loras, 'lora');
            } else {
                uiHelper.showToastNotification('未找到可用LoRA模型', 'warning');
            }
        } catch (error) {
            uiHelper.showToastNotification(`获取LoRA列表失败: ${error.message}`, 'error');
        }
    }

    /**
     * Shows ComfyUI model/LoRA selection dialog with proper UI
     */
    function showComfyUIModelSelectionDialog(items, type) {
        const isModel = type === 'model';
        const title = isModel ? '选择模型' : '选择LoRA';
        const targetInput = isModel ? comfyuiModelNameInput : comfyuiLoraNameInput;
        
        // Create modal dialog elements
        const modalId = `comfyui${isModel ? 'Model' : 'Lora'}SelectModal`;
        let modal = document.getElementById(modalId);
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close-button">&times;</span>
                    <h2>${title}</h2>
                    <div class="model-search-container">
                        <input type="text" id="${modalId}SearchInput" placeholder="搜索${isModel ? '模型' : 'LoRA'}..." class="model-search-input">
                    </div>
                    <ul id="${modalId}List" class="model-list" style="max-height: 400px; overflow-y: auto;">
                        <!-- Items will be dynamically loaded here -->
                    </ul>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Add event listeners
            const closeBtn = modal.querySelector('.close-button');
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
            
            const searchInput = modal.querySelector(`#${modalId}SearchInput`);
            searchInput.addEventListener('input', () => {
                filterComfyUIItems(modalId, searchInput.value);
            });
            
            // Close modal when clicking outside
            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
        
        // Populate the list
        const list = modal.querySelector(`#${modalId}List`);
        list.innerHTML = '';
        
        if (!items || items.length === 0) {
            list.innerHTML = `<li style="text-align: center; color: var(--secondary-text); padding: 20px;">没有可用的${isModel ? '模型' : 'LoRA'}。</li>`;
        } else {
            items.forEach(item => {
                const itemName = typeof item === 'string' ? item : (item.name || item);
                const li = document.createElement('li');
                li.textContent = itemName;
                li.style.cursor = 'pointer';
                li.style.padding = '8px 12px';
                li.style.borderBottom = '1px solid var(--border-color)';
                li.addEventListener('click', () => {
                    if (targetInput) {
                        targetInput.value = itemName;
                    }
                    modal.style.display = 'none';
                });
                
                // Add hover effect
                li.addEventListener('mouseenter', () => {
                    li.style.backgroundColor = 'var(--hover-bg)';
                });
                li.addEventListener('mouseleave', () => {
                    li.style.backgroundColor = '';
                });
                
                list.appendChild(li);
            });
        }
        
        // Show modal
        modal.style.display = 'block';
    }
    
    /**
     * Filters ComfyUI model/LoRA items based on search input
     */
    function filterComfyUIItems(modalId, searchText) {
        const list = document.querySelector(`#${modalId}List`);
        if (!list) return;
        
        const items = list.getElementsByTagName('li');
        const filter = searchText.toLowerCase();
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const text = item.textContent || item.innerText;
            if (text.toLowerCase().indexOf(filter) > -1) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        }
    }

    // --- Public API ---
    return {
        init: (options) => {
            electronAPI = options.electronAPI;
            uiHelper = options.uiHelper;
            refs = options.refs;
            mainRendererFunctions = options.mainRendererFunctions;

            // DOM Elements
            agentSettingsContainer = options.elements.agentSettingsContainer;
            groupSettingsContainer = options.elements.groupSettingsContainer;
            selectItemPromptForSettings = options.elements.selectItemPromptForSettings;
            itemSettingsContainerTitle = options.elements.itemSettingsContainerTitle;
            selectedItemNameForSettingsSpan = options.elements.selectedItemNameForSettingsSpan;
            deleteItemBtn = options.elements.deleteItemBtn;
            agentSettingsForm = options.elements.agentSettingsForm;
            editingAgentIdInput = options.elements.editingAgentIdInput;
            agentNameInput = options.elements.agentNameInput;
            agentAvatarInput = options.elements.agentAvatarInput;
            agentAvatarPreview = options.elements.agentAvatarPreview;
            agentSystemPromptTextarea = options.elements.agentSystemPromptTextarea;
            agentModelInput = options.elements.agentModelInput;
            agentTemperatureInput = options.elements.agentTemperatureInput;
            agentContextTokenLimitInput = options.elements.agentContextTokenLimitInput;
            agentMaxOutputTokensInput = options.elements.agentMaxOutputTokensInput;
            agentTopPInput = document.getElementById('agentTopP');
            agentTopKInput = document.getElementById('agentTopK');
            openModelSelectBtn = options.elements.openModelSelectBtn;
            modelSelectModal = options.elements.modelSelectModal;
            modelList = options.elements.modelList;
            modelSearchInput = options.elements.modelSearchInput;
            refreshModelsBtn = options.elements.refreshModelsBtn;
            
            // TTS Elements
            agentTtsVoicePrimarySelect = document.getElementById('agentTtsVoicePrimary');
            agentTtsRegexPrimaryInput = document.getElementById('agentTtsRegexPrimary');
            agentTtsVoiceSecondarySelect = document.getElementById('agentTtsVoiceSecondary');
            agentTtsRegexSecondaryInput = document.getElementById('agentTtsRegexSecondary');
            refreshTtsModelsBtn = document.getElementById('refreshTtsModelsBtn');
            agentTtsSpeedSlider = options.elements.agentTtsSpeedSlider;
            ttsSpeedValueSpan = options.elements.ttsSpeedValueSpan;

            // ComfyUI Elements
            openComfyUIConfigBtn = document.getElementById('openComfyUIConfigBtn');
            comfyuiConfigModal = document.getElementById('comfyuiConfigModal');
            comfyuiConfigForm = document.getElementById('comfyuiConfigForm');
            comfyuiSeedInput = document.getElementById('comfyuiSeed');
            randomSeedBtn = document.getElementById('randomSeedBtn');
            comfyuiStepsInput = document.getElementById('comfyuiSteps');
            comfyuiCfgScaleInput = document.getElementById('comfyuiCfgScale');
            comfyuiSamplerNameSelect = document.getElementById('comfyuiSamplerName');
            comfyuiSchedulerSelect = document.getElementById('comfyuiScheduler');
            comfyuiWidthInput = document.getElementById('comfyuiWidth');
            comfyuiHeightInput = document.getElementById('comfyuiHeight');
            comfyuiModelNameInput = document.getElementById('comfyuiModelName');
            loadModelsBtn = document.getElementById('loadModelsBtn');
            comfyuiLoraNameInput = document.getElementById('comfyuiLoraName');
            loadLorasBtn = document.getElementById('loadLorasBtn');
            comfyuiNegativePromptTextarea = document.getElementById('comfyuiNegativePrompt');
            comfyuiWorkflowSelect = document.getElementById('comfyuiWorkflow');
            refreshWorkflowsBtn = document.getElementById('refreshWorkflowsBtn');
            testComfyUIConnectionBtn = document.getElementById('testComfyUIConnectionBtn');

            // Event Listeners
            if (agentSettingsForm) {
                agentSettingsForm.addEventListener('submit', saveCurrentAgentSettings);
            }
            if (deleteItemBtn) {
                deleteItemBtn.addEventListener('click', handleDeleteCurrentItem);
            }
            if(agentAvatarInput){
                agentAvatarInput.addEventListener('change', (event) => {
                    const file = event.target.files[0];
                    if (file) {
                        uiHelper.openAvatarCropper(file, (croppedFileResult) => {
                            mainRendererFunctions.setCroppedFile('agent', croppedFileResult);
                            if (agentAvatarPreview) {
                                agentAvatarPreview.src = URL.createObjectURL(croppedFileResult);
                                agentAvatarPreview.style.display = 'block';
                            }
                        }, 'agent');
                    } else {
                        if(agentAvatarPreview) agentAvatarPreview.style.display = 'none';
                        mainRendererFunctions.setCroppedFile('agent', null);
                    }
                });
            }

            if (openModelSelectBtn) {
                openModelSelectBtn.addEventListener('click', handleOpenModelSelect);
            }
            if (modelSearchInput) {
                modelSearchInput.addEventListener('input', filterModels);
            }
            if (refreshModelsBtn) {
                refreshModelsBtn.addEventListener('click', handleRefreshModels);
            }
            if (electronAPI.onModelsUpdated) {
                electronAPI.onModelsUpdated((models) => {
                    console.log('[SettingsManager] Received models-updated event. Repopulating list.');
                    populateModelList(models);
                    uiHelper.showToastNotification('模型列表已刷新', 'success');
                });
            }
            
            if (agentTtsSpeedSlider && ttsSpeedValueSpan) {
                agentTtsSpeedSlider.addEventListener('input', () => {
                    ttsSpeedValueSpan.textContent = parseFloat(agentTtsSpeedSlider.value).toFixed(1);
                });
            }

            if (refreshTtsModelsBtn) {
                refreshTtsModelsBtn.addEventListener('click', async () => {
                    uiHelper.showToastNotification('正在刷新语音模型...', 'info');
                    try {
                        await electronAPI.sovitsGetModels(true); // force refresh
                        await populateTtsModels(agentTtsVoicePrimarySelect.value, agentTtsVoiceSecondarySelect.value); // repopulate
                        uiHelper.showToastNotification('语音模型列表已刷新', 'success');
                    } catch (e) {
                        uiHelper.showToastNotification('刷新语音模型失败', 'error');
                    }
                });
            }

            // ComfyUI Event Listeners
            if (openComfyUIConfigBtn) {
                openComfyUIConfigBtn.addEventListener('click', openComfyUIConfig);
            }
            
            if (comfyuiConfigForm) {
                comfyuiConfigForm.addEventListener('submit', saveComfyUIConfig);
            }
            
            if (randomSeedBtn) {
                randomSeedBtn.addEventListener('click', generateRandomSeed);
            }
            
            if (testComfyUIConnectionBtn) {
                testComfyUIConnectionBtn.addEventListener('click', testComfyUIConnection);
            }
            
            if (loadModelsBtn) {
                loadModelsBtn.addEventListener('click', loadComfyUIModels);
            }
            
            if (loadLorasBtn) {
                loadLorasBtn.addEventListener('click', loadComfyUILoras);
            }
            
            if (refreshWorkflowsBtn) {
                refreshWorkflowsBtn.addEventListener('click', refreshWorkflowsList);
            }

            console.log('settingsManager initialized.');

            // --- Global Settings Enhancements ---
            const vcpServerUrlInput = document.getElementById('vcpServerUrl');
            if (vcpServerUrlInput) {
                vcpServerUrlInput.addEventListener('blur', () => {
                    const completedUrl = completeVcpUrl(vcpServerUrlInput.value);
                    vcpServerUrlInput.value = completedUrl;
                });
            }
        },
        displaySettingsForItem: displaySettingsForItem,
        populateAssistantAgentSelect: populateAssistantAgentSelect,
        // Expose for external use if needed, e.g., in the save function
        completeVcpUrl: completeVcpUrl
    };

    /**
     * Opens the model selection modal and populates it with cached models.
     */
    async function handleOpenModelSelect() {
        try {
            const models = await electronAPI.getCachedModels();
            populateModelList(models);
            uiHelper.openModal('modelSelectModal');
        } catch (error) {
            console.error('Failed to get cached models:', error);
            uiHelper.showToastNotification('获取模型列表失败', 'error');
        }
    }

    /**
     * Populates the model list in the modal.
     * @param {Array} models - An array of model objects.
     */
    function populateModelList(models) {
        if (!modelList) return;
        modelList.innerHTML = ''; // Clear existing list

        if (!models || models.length === 0) {
            modelList.innerHTML = '<li>没有可用的模型。请检查您的 VCP 服务器 URL 或刷新列表。</li>';
            return;
        }

        models.forEach(model => {
            const li = document.createElement('li');
            li.textContent = model.id;
            li.dataset.modelId = model.id;
            li.addEventListener('click', () => {
                if (agentModelInput) {
                    agentModelInput.value = model.id;
                }
                uiHelper.closeModal('modelSelectModal');
            });
            modelList.appendChild(li);
        });
    }

    /**
     * Filters the model list based on the search input.
     */
    function filterModels() {
        const filter = modelSearchInput.value.toLowerCase();
        const items = modelList.getElementsByTagName('li');
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const txtValue = item.textContent || item.innerText;
            if (txtValue.toLowerCase().indexOf(filter) > -1) {
                item.style.display = "";
            } else {
                item.style.display = "none";
            }
        }
    }

    /**
     * Handles the refresh models button click.
     */
    function handleRefreshModels() {
        if (electronAPI.refreshModels) {
            electronAPI.refreshModels();
            uiHelper.showToastNotification('正在刷新模型列表...', 'info');
        }
    }
})();

window.settingsManager = settingsManager;