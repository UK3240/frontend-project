// Global state
let blocks = [];
let connections = [];
let selectedBlock = null;
let selectedConnection = null;
let isDragging = false;
let isConnecting = false;
let dragOffset = { x: 0, y: 0 };
let connectionStart = null;
let blockIdCounter = 0;

// Advanced features state
let zoomLevel = 1.0;
let panOffset = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
let currentMode = 'select'; // 'select' or 'pan'
let history = [];
let historyIndex = -1;
const MAX_HISTORY = 50;
const API_BASE_URL = 'http://localhost:8080/api';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeCanvas();
    initializeToolbar();
    initializeEventListeners();
    initializeAdvancedFeatures();
    saveState(); // Initial state
});

// Initialize Canvas
function initializeCanvas() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    
    // Resize canvas to fit container
    function resizeCanvas() {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        redrawConnections();
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

// Initialize Toolbar
function initializeToolbar() {
    const blockItems = document.querySelectorAll('.block-item');
    
    blockItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
    });
}

// Handle drag start from toolbar
function handleDragStart(e) {
    const blockType = e.target.closest('.block-item').dataset.type;
    e.dataTransfer.setData('blockType', blockType);
    e.dataTransfer.effectAllowed = 'copy';
}

// Handle drag end from toolbar
function handleDragEnd(e) {
    // Cleanup if needed
}

// Initialize Event Listeners
function initializeEventListeners() {
    const canvas = document.getElementById('canvas');
    const workspace = document.querySelector('.workspace');
    const blocksContainer = document.getElementById('blocks-container');
    
    // Canvas drop zone
    workspace.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    
    workspace.addEventListener('drop', (e) => {
        e.preventDefault();
        const blockType = e.dataTransfer.getData('blockType');
        if (blockType) {
            const rect = workspace.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            createBlock(blockType, x, y);
        }
    });
    
    // Mouse events for canvas
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('click', handleCanvasClick);
    
    // Update coordinates
    workspace.addEventListener('mousemove', (e) => {
        const rect = workspace.getBoundingClientRect();
        const x = Math.floor(e.clientX - rect.left);
        const y = Math.floor(e.clientY - rect.top);
        document.getElementById('coordinates').textContent = `X: ${x}, Y: ${y}`;
    });
    
    // Button events
    document.getElementById('saveBtn').addEventListener('click', saveToServer);
    document.getElementById('loadBtn').addEventListener('click', loadFromServer);
    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('redoBtn').addEventListener('click', redo);
    document.getElementById('clearBtn').addEventListener('click', clearCanvas);
    document.getElementById('reduceBtn').addEventListener('click', reduceGraph);
    document.getElementById('exportBtn').addEventListener('click', exportCanvas);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Update counters
    updateCounters();
}

// Create Block
function createBlock(type, x, y) {
    blockIdCounter++;
    const block = {
        id: blockIdCounter,
        type: type,
        x: x - 50,
        y: y - 30,
        width: type === 'summer' ? 60 : 100,
        height: type === 'summer' ? 60 : 60,
        value: getDefaultValue(type),
        label: getBlockLabel(type),
        inputs: type === 'summer' ? [] : null  // Store input connections with signs for summer
    };
    
    blocks.push(block);
    renderBlock(block);
    updateStatus(`Created ${block.label} block`);
    saveState();
    updateCounters();
}

// Get default value for block type
function getDefaultValue(type) {
    const defaults = {
        'gain': '1',
        'summer': 'Σ',
        'integrator': '1/s',
        'differentiator': 's',
        'node': '',
        'branch': '1',
        'input': 'R(s)',
        'output': 'C(s)'
    };
    return defaults[type] || '';
}

// Get block label
function getBlockLabel(type) {
    const labels = {
        'gain': 'Gain',
        'summer': 'Summer',
        'integrator': 'Integrator',
        'differentiator': 'Differentiator',
        'node': 'Node',
        'branch': 'Branch',
        'input': 'Input',
        'output': 'Output'
    };
    return labels[type] || type;
}

// Render Block
function renderBlock(block) {
    const blocksContainer = document.getElementById('blocks-container');
    
    const blockElement = document.createElement('div');
    blockElement.className = 'block';
    blockElement.dataset.id = block.id;
    blockElement.style.left = block.x + 'px';
    blockElement.style.top = block.y + 'px';
    
    // Special rendering for summer (summing junction - circle)
    if (block.type === 'summer') {
        blockElement.innerHTML = `
            <div class="block-content summer-content">
                <svg width="60" height="60" viewBox="0 0 60 60">
                    <circle cx="30" cy="30" r="25" fill="white" stroke="#e74c3c" stroke-width="3"/>
                    <text x="30" y="38" text-anchor="middle" font-size="24" fill="#e74c3c" font-weight="bold">Σ</text>
                </svg>
            </div>
            <div class="connection-point output" data-point="output"></div>
        `;
    } else {
        blockElement.innerHTML = `
            <div class="block-content">
                <div class="block-label">${block.label}</div>
                <div class="block-value">${block.value}</div>
            </div>
            <div class="connection-point input" data-point="input"></div>
            <div class="connection-point output" data-point="output"></div>
        `;
    }
    
    // Add event listeners
    blockElement.addEventListener('mousedown', (e) => handleBlockMouseDown(e, block));
    blockElement.querySelectorAll('.connection-point').forEach(point => {
        point.addEventListener('mousedown', (e) => handleConnectionPointMouseDown(e, block, point));
    });
    
    blocksContainer.appendChild(blockElement);
    
    // For summer blocks, update input points after rendering
    if (block.type === 'summer') {
        updateSummerInputs(block);
    }
    
    updateBlockSelection(block.id);
}

// Handle block mouse down
function handleBlockMouseDown(e, block) {
    if (e.target.classList.contains('connection-point')) return;
    
    e.stopPropagation();
    selectedBlock = block;
    isDragging = true;
    
    const blockElement = document.querySelector(`[data-id="${block.id}"]`);
    const rect = blockElement.getBoundingClientRect();
    const workspace = document.querySelector('.workspace');
    const workspaceRect = workspace.getBoundingClientRect();
    
    dragOffset.x = e.clientX - rect.left - workspaceRect.left;
    dragOffset.y = e.clientY - rect.top - workspaceRect.top;
    
    updateBlockSelection(block.id);
    updatePropertiesPanel(block);
}

// Handle connection point mouse down
function handleConnectionPointMouseDown(e, block, point) {
    e.stopPropagation();
    const pointType = point.dataset.point;
    
    if (!isConnecting) {
        // Start new connection
        isConnecting = true;
        connectionStart = {
            block: block,
            type: pointType,
            element: point
        };
        updateStatus('Click on another connection point to connect');
    } else {
        // Complete connection
        if (connectionStart.block.id !== block.id && pointType !== connectionStart.type) {
            createConnection(connectionStart.block, connectionStart.type, block, pointType);
        }
        isConnecting = false;
        connectionStart = null;
        updateStatus('Ready');
    }
}

// Create Connection
function createConnection(fromBlock, fromType, toBlock, toType) {
    // Ensure we're connecting output to input
    if (fromType === 'input' || toType === 'output') {
        [fromBlock, toBlock] = [toBlock, fromBlock];
        [fromType, toType] = [toType, fromType];
    }
    
    // For summer blocks, allow multiple inputs
    if (toBlock.type === 'summer') {
        // Initialize inputs array if not exists
        if (!toBlock.inputs) {
            toBlock.inputs = [];
        }
        
        // Check if connection already exists
        const existingInput = toBlock.inputs.find(inp => inp.from === fromBlock.id);
        if (existingInput) {
            updateStatus('Connection already exists');
            return;
        }
        
        // Add input with default positive sign
        toBlock.inputs.push({
            from: fromBlock.id,
            sign: '+'  // Default to positive, can be changed in properties
        });
        
        // Update summer rendering to show input signs
        updateSummerInputs(toBlock);
    }
    
    const connection = {
        id: connections.length + 1,
        from: fromBlock.id,
        fromType: 'output',
        to: toBlock.id,
        toType: 'input',
        inputIndex: toBlock.type === 'summer' ? toBlock.inputs.length - 1 : null
    };
    
    connections.push(connection);
    redrawConnections();
    updateStatus(`Connected ${fromBlock.label} to ${toBlock.label}`);
    saveState();
    updateCounters();
}

// Update Summer Inputs Display
function updateSummerInputs(block) {
    const blockElement = document.querySelector(`[data-id="${block.id}"]`);
    if (!blockElement || block.type !== 'summer') return;
    
    // Remove existing input points
    blockElement.querySelectorAll('.summer-input').forEach(point => point.remove());
    
    // Add input points for each connection
    if (block.inputs && block.inputs.length > 0) {
        const numInputs = block.inputs.length;
        const spacing = 60 / (numInputs + 1);
        
        block.inputs.forEach((input, index) => {
            const inputPoint = document.createElement('div');
            inputPoint.className = `connection-point input summer-input`;
            inputPoint.dataset.point = 'input';
            inputPoint.dataset.sign = input.sign;
            inputPoint.dataset.inputIndex = index;
            inputPoint.style.left = '-6px';
            inputPoint.style.top = `${(index + 1) * spacing}px`;
            inputPoint.style.transform = 'translateY(-50%)';
            
            // Add sign indicator
            const signLabel = document.createElement('div');
            signLabel.className = 'summer-sign-label';
            signLabel.textContent = input.sign;
            signLabel.style.position = 'absolute';
            signLabel.style.left = '-20px';
            signLabel.style.top = '50%';
            signLabel.style.transform = 'translateY(-50%)';
            signLabel.style.color = input.sign === '+' ? '#27ae60' : '#e74c3c';
            signLabel.style.fontWeight = 'bold';
            signLabel.style.fontSize = '16px';
            inputPoint.appendChild(signLabel);
            
            inputPoint.addEventListener('mousedown', (e) => handleConnectionPointMouseDown(e, block, inputPoint));
            blockElement.appendChild(inputPoint);
        });
    } else {
        // Default single input point
        const inputPoint = document.createElement('div');
        inputPoint.className = 'connection-point input summer-input';
        inputPoint.dataset.point = 'input';
        inputPoint.dataset.sign = '+';
        inputPoint.style.left = '-6px';
        inputPoint.style.top = '50%';
        inputPoint.style.transform = 'translateY(-50%)';
        inputPoint.addEventListener('mousedown', (e) => handleConnectionPointMouseDown(e, block, inputPoint));
        blockElement.appendChild(inputPoint);
    }
}

// Redraw Connections
function redrawConnections() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw arrow marker definition
    if (!document.getElementById('arrowhead')) {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '10');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3');
        marker.setAttribute('orient', 'auto');
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 10 3, 0 6');
        polygon.setAttribute('fill', '#34495e');
        marker.appendChild(polygon);
        defs.appendChild(marker);
    }
    
    // Draw connections
    connections.forEach(conn => {
        const fromBlock = blocks.find(b => b.id === conn.from);
        const toBlock = blocks.find(b => b.id === conn.to);
        
        if (fromBlock && toBlock) {
            const fromX = fromBlock.x + fromBlock.width;
            const fromY = fromBlock.y + fromBlock.height / 2;
            
            // For summer blocks, calculate input position based on input index
            let toX, toY;
            if (toBlock.type === 'summer' && toBlock.inputs && conn.inputIndex !== null) {
                const numInputs = toBlock.inputs.length;
                const spacing = toBlock.height / (numInputs + 1);
                toX = toBlock.x;
                toY = toBlock.y + (conn.inputIndex + 1) * spacing;
            } else {
                toX = toBlock.x;
                toY = toBlock.y + toBlock.height / 2;
            }
            
            // Draw line
            ctx.strokeStyle = selectedConnection === conn.id ? '#667eea' : '#34495e';
            ctx.lineWidth = selectedConnection === conn.id ? 3 : 2;
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            
            // Bezier curve for smooth connection
            const cp1x = fromX + (toX - fromX) * 0.5;
            const cp1y = fromY;
            const cp2x = fromX + (toX - fromX) * 0.5;
            const cp2y = toY;
            
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, toX, toY);
            ctx.stroke();
            
            // Draw arrowhead
            const angle = Math.atan2(toY - cp2y, toX - cp2x);
            const arrowLength = 10;
            
            ctx.beginPath();
            ctx.moveTo(toX, toY);
            ctx.lineTo(
                toX - arrowLength * Math.cos(angle - Math.PI / 6),
                toY - arrowLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.moveTo(toX, toY);
            ctx.lineTo(
                toX - arrowLength * Math.cos(angle + Math.PI / 6),
                toY - arrowLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.stroke();
        }
    });
}

// Handle Canvas Mouse Down
function handleCanvasMouseDown(e) {
    if (e.target === document.getElementById('canvas')) {
        selectedBlock = null;
        selectedConnection = null;
        updateBlockSelection(null);
        updatePropertiesPanel(null);
    }
}

// Handle Canvas Mouse Move
function handleCanvasMouseMove(e) {
    if (isDragging && selectedBlock) {
        const workspace = document.querySelector('.workspace');
        const rect = workspace.getBoundingClientRect();
        
        selectedBlock.x = e.clientX - rect.left - dragOffset.x;
        selectedBlock.y = e.clientY - rect.top - dragOffset.y;
        
        const blockElement = document.querySelector(`[data-id="${selectedBlock.id}"]`);
        if (blockElement) {
            blockElement.style.left = selectedBlock.x + 'px';
            blockElement.style.top = selectedBlock.y + 'px';
        }
        
        redrawConnections();
    }
}

// Handle Canvas Mouse Up
function handleCanvasMouseUp(e) {
    isDragging = false;
}

// Handle Canvas Click
function handleCanvasClick(e) {
    // Handle connection selection if clicking on a line (simplified)
}

// Update Block Selection
function updateBlockSelection(blockId) {
    document.querySelectorAll('.block').forEach(block => {
        block.classList.remove('selected');
    });
    
    if (blockId) {
        const blockElement = document.querySelector(`[data-id="${blockId}"]`);
        if (blockElement) {
            blockElement.classList.add('selected');
        }
    }
}

// Update Properties Panel
function updatePropertiesPanel(block) {
    const propertiesContent = document.getElementById('properties-content');
    
    if (!block) {
        propertiesContent.innerHTML = '<p class="placeholder">Select a block to edit properties</p>';
        return;
    }
    
    let html = `
        <div class="property-group">
            <label>Type</label>
            <input type="text" value="${block.label}" readonly>
        </div>
    `;
    
    // For summer blocks, show input signs configuration
    if (block.type === 'summer' && block.inputs && block.inputs.length > 0) {
        html += `<div class="property-group">
            <label>Input Signs (Positive/Negative Feedback)</label>`;
        
        block.inputs.forEach((input, index) => {
            const fromBlock = blocks.find(b => b.id === input.from);
            const blockName = fromBlock ? fromBlock.label : `Input ${index + 1}`;
            html += `
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <span style="flex: 1; font-size: 12px;">${blockName}:</span>
                    <button class="btn ${input.sign === '+' ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="toggleInputSign(${block.id}, ${index})" 
                            style="min-width: 40px; padding: 4px 8px;">
                        ${input.sign}
                    </button>
                </div>
            `;
        });
        
        html += `</div>`;
    } else if (block.type !== 'summer') {
        html += `
        <div class="property-group">
            <label>Value</label>
            <input type="text" id="block-value-input" value="${block.value}" 
                   onchange="updateBlockValue(${block.id}, this.value)">
        </div>`;
    }
    
    html += `
        <div class="property-group">
            <label>Position X</label>
            <input type="number" id="block-x-input" value="${block.x}" 
                   onchange="updateBlockPosition(${block.id}, 'x', this.value)">
        </div>
        <div class="property-group">
            <label>Position Y</label>
            <input type="number" id="block-y-input" value="${block.y}" 
                   onchange="updateBlockPosition(${block.id}, 'y', this.value)">
        </div>
        <div class="property-group">
            <button class="btn btn-secondary" onclick="deleteBlock(${block.id})" 
                    style="width: 100%; margin-top: 10px;">Delete Block</button>
        </div>
    `;
    
    propertiesContent.innerHTML = html;
}

// Toggle Input Sign for Summer Block
function toggleInputSign(blockId, inputIndex) {
    const block = blocks.find(b => b.id === blockId);
    if (block && block.type === 'summer' && block.inputs && block.inputs[inputIndex]) {
        // Toggle between + and -
        block.inputs[inputIndex].sign = block.inputs[inputIndex].sign === '+' ? '-' : '+';
        updateSummerInputs(block);
        updatePropertiesPanel(block);
        updateStatus(`Changed input sign to ${block.inputs[inputIndex].sign}`);
    }
}

// Update Block Value
function updateBlockValue(blockId, value) {
    const block = blocks.find(b => b.id === blockId);
    if (block) {
        block.value = value;
        const blockElement = document.querySelector(`[data-id="${blockId}"]`);
        if (blockElement) {
            blockElement.querySelector('.block-value').textContent = value;
        }
        updateStatus(`Updated ${block.label} value to ${value}`);
    }
}

// Update Block Position
function updateBlockPosition(blockId, axis, value) {
    const block = blocks.find(b => b.id === blockId);
    if (block) {
        block[axis] = parseInt(value);
        const blockElement = document.querySelector(`[data-id="${blockId}"]`);
        if (blockElement) {
            blockElement.style[axis] = value + 'px';
        }
        redrawConnections();
    }
}

// Delete Block
function deleteBlock(blockId) {
    // Remove connections involving this block
    connections.forEach(c => {
        if (c.to === blockId) {
            // If deleting a block that receives input from a summer, clean up summer inputs
            const toBlock = blocks.find(b => b.id === c.to);
            if (toBlock && toBlock.type === 'summer' && toBlock.inputs) {
                toBlock.inputs = toBlock.inputs.filter(inp => inp.from !== c.from);
                updateSummerInputs(toBlock);
            }
        } else if (c.from === blockId) {
            // If deleting a block that sends output to a summer, remove from summer inputs
            const toBlock = blocks.find(b => b.id === c.to);
            if (toBlock && toBlock.type === 'summer' && toBlock.inputs) {
                toBlock.inputs = toBlock.inputs.filter(inp => inp.from !== blockId);
                updateSummerInputs(toBlock);
            }
        }
    });
    
    connections = connections.filter(c => c.from !== blockId && c.to !== blockId);
    blocks = blocks.filter(b => b.id !== blockId);
    
    const blockElement = document.querySelector(`[data-id="${blockId}"]`);
    if (blockElement) {
        blockElement.remove();
    }
    
    redrawConnections();
    updatePropertiesPanel(null);
    updateStatus('Block deleted');
    saveState();
    updateCounters();
}

// Clear Canvas
function clearCanvas() {
    if (confirm('Are you sure you want to clear the canvas?')) {
        blocks = [];
        connections = [];
        selectedBlock = null;
        document.getElementById('blocks-container').innerHTML = '';
        redrawConnections();
        updatePropertiesPanel(null);
        updateStatus('Canvas cleared');
        saveState();
        updateCounters();
    }
}

// Initialize Advanced Features
function initializeAdvancedFeatures() {
    // Zoom controls
    document.getElementById('zoomIn').addEventListener('click', () => setZoom(zoomLevel + 0.1));
    document.getElementById('zoomOut').addEventListener('click', () => setZoom(zoomLevel - 0.1));
    document.getElementById('zoomReset').addEventListener('click', () => setZoom(1.0));
    
    // View mode controls
    document.getElementById('panBtn').addEventListener('click', () => setMode('pan'));
    document.getElementById('selectBtn').addEventListener('click', () => setMode('select'));
    
    // Pan functionality
    const canvasWrapper = document.getElementById('canvas-wrapper');
    canvasWrapper.addEventListener('mousedown', handlePanStart);
    canvasWrapper.addEventListener('mousemove', handlePanMove);
    canvasWrapper.addEventListener('mouseup', handlePanEnd);
    canvasWrapper.addEventListener('mouseleave', handlePanEnd);
    
    // Mouse wheel zoom
    canvasWrapper.addEventListener('wheel', handleWheelZoom, { passive: false });
}

// Zoom Functions
function setZoom(level) {
    zoomLevel = Math.max(0.1, Math.min(3.0, level));
    const canvasWrapper = document.getElementById('canvas-wrapper');
    canvasWrapper.style.transform = `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`;
    document.getElementById('zoomLevel').textContent = Math.round(zoomLevel * 100) + '%';
}

function handleWheelZoom(e) {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(zoomLevel + delta);
    }
}

// Pan Functions
function setMode(mode) {
    currentMode = mode;
    const canvasWrapper = document.getElementById('canvas-wrapper');
    const panBtn = document.getElementById('panBtn');
    const selectBtn = document.getElementById('selectBtn');
    
    if (mode === 'pan') {
        canvasWrapper.classList.add('panning');
        panBtn.classList.add('active');
        selectBtn.classList.remove('active');
    } else {
        canvasWrapper.classList.remove('panning');
        panBtn.classList.remove('active');
        selectBtn.classList.add('active');
    }
}

function handlePanStart(e) {
    if (currentMode === 'pan' || e.button === 1) {
        isPanning = true;
        panStart = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
        e.preventDefault();
    }
}

function handlePanMove(e) {
    if (isPanning) {
        panOffset.x = e.clientX - panStart.x;
        panOffset.y = e.clientY - panStart.y;
        const canvasWrapper = document.getElementById('canvas-wrapper');
        canvasWrapper.style.transform = `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`;
    }
}

function handlePanEnd(e) {
    isPanning = false;
}

// Undo/Redo Functions
function saveState() {
    const state = {
        blocks: JSON.parse(JSON.stringify(blocks)),
        connections: JSON.parse(JSON.stringify(connections)),
        blockIdCounter: blockIdCounter
    };
    
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }
    
    history.push(state);
    historyIndex++;
    
    if (history.length > MAX_HISTORY) {
        history.shift();
        historyIndex--;
    }
    
    updateUndoRedoButtons();
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        restoreState(history[historyIndex]);
        updateStatus('Undone');
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        restoreState(history[historyIndex]);
        updateStatus('Redone');
    }
}

function restoreState(state) {
    blocks = JSON.parse(JSON.stringify(state.blocks));
    connections = JSON.parse(JSON.stringify(state.connections));
    blockIdCounter = state.blockIdCounter;
    
    document.getElementById('blocks-container').innerHTML = '';
    blocks.forEach(block => renderBlock(block));
    redrawConnections();
    updateCounters();
    updatePropertiesPanel(null);
}

function updateUndoRedoButtons() {
    document.getElementById('undoBtn').disabled = historyIndex <= 0;
    document.getElementById('redoBtn').disabled = historyIndex >= history.length - 1;
}

// Keyboard Shortcuts
function handleKeyboardShortcuts(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
    }
    if (e.key === ' ') {
        e.preventDefault();
        setMode('pan');
    }
    if (e.key === 'Escape') {
        setMode('select');
    }
    if (e.key === 'Delete' && selectedBlock) {
        deleteBlock(selectedBlock.id);
    }
}

// Update Counters
function updateCounters() {
    document.getElementById('block-count').textContent = `Blocks: ${blocks.length}`;
    document.getElementById('connection-count').textContent = `Connections: ${connections.length}`;
}

// Save/Load Functions
async function saveToServer() {
    const diagramName = prompt('Enter diagram name:', 'My Diagram') || 'My Diagram';
    const diagramData = {
        name: diagramName,
        blocks: blocks,
        connections: connections,
        metadata: {
            created: new Date().toISOString(),
            version: '1.0'
        }
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/diagrams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(diagramData)
        });
        
        if (response.ok) {
            const result = await response.json();
            updateStatus(`Diagram saved: ${result.name}`);
            alert(`Diagram saved!\nID: ${result.id}\nName: ${result.name}`);
        } else {
            throw new Error('Failed to save');
        }
    } catch (error) {
        localStorage.setItem('diagram_backup', JSON.stringify(diagramData));
        updateStatus('Saved to local storage');
        alert('Server unavailable. Saved to local storage.');
    }
}

async function loadFromServer() {
    try {
        const response = await fetch(`${API_BASE_URL}/diagrams`);
        if (response.ok) {
            const diagrams = await response.json();
            if (diagrams.length === 0) {
                alert('No saved diagrams found.');
                return;
            }
            const diagramList = diagrams.map((d, i) => `${i + 1}. ${d.name} (ID: ${d.id})`).join('\n');
            const choice = prompt(`Available diagrams:\n\n${diagramList}\n\nEnter diagram ID:`);
            if (choice) {
                const diagramId = parseInt(choice);
                const diagram = diagrams.find(d => d.id === diagramId);
                if (diagram) {
                    if (confirm(`Load "${diagram.name}"?`)) {
                        loadDiagramData(diagram);
                    }
                } else {
                    alert('Diagram not found!');
                }
            }
        } else {
            throw new Error('Failed to load');
        }
    } catch (error) {
        const backup = localStorage.getItem('diagram_backup');
        if (backup) {
            if (confirm('Server unavailable. Load from local backup?')) {
                loadDiagramData(JSON.parse(backup));
            }
        } else {
            alert('Server unavailable and no backup found.');
        }
    }
}

function loadDiagramData(diagramData) {
    blocks = diagramData.blocks || [];
    connections = diagramData.connections || [];
    blockIdCounter = Math.max(...blocks.map(b => b.id || 0), 0);
    document.getElementById('blocks-container').innerHTML = '';
    blocks.forEach(block => renderBlock(block));
    redrawConnections();
    updateCounters();
    saveState();
    updateStatus(`Loaded: ${diagramData.name || 'Diagram'}`);
}

// Enhanced Reduce Graph with API call
async function reduceGraph() {
    if (blocks.length === 0) {
        alert('Please add blocks to the canvas first');
        return;
    }
    
    const graphData = { blocks: blocks, connections: connections };
    
    try {
        updateStatus('Reducing graph...');
        const response = await fetch(`${API_BASE_URL}/reduce`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(graphData)
        });
        
        if (response.ok) {
            const result = await response.json();
            const message = `Graph Reduced!\n\nOriginal: ${blocks.length} blocks\n` +
                          `Reduced: ${result.reducedBlocks?.length || 0} blocks\n` +
                          `Transfer Function: ${result.transferFunction || 'N/A'}\n\nApply?`;
            
            if (confirm(message)) {
                if (result.reducedBlocks && result.reducedConnections) {
                    blocks = result.reducedBlocks;
                    connections = result.reducedConnections;
                    document.getElementById('blocks-container').innerHTML = '';
                    blocks.forEach(block => renderBlock(block));
                    redrawConnections();
                    updateCounters();
                    saveState();
                    updateStatus('Graph reduced successfully');
                }
            }
        } else {
            throw new Error('Reduction failed');
        }
    } catch (error) {
        updateStatus('Reduction failed: ' + error.message);
        alert('Server error. Make sure backend is running on port 8080.');
    }
}

// Export Canvas
function exportCanvas() {
    const canvas = document.getElementById('canvas');
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'block-diagram.png';
    link.href = dataURL;
    link.click();
    updateStatus('Canvas exported');
}

// Update Status
function updateStatus(message) {
    document.getElementById('status-text').textContent = message;
    setTimeout(() => {
        document.getElementById('status-text').textContent = 'Ready';
    }, 3000);
}

// Make functions globally available
window.updateBlockValue = updateBlockValue;
window.updateBlockPosition = updateBlockPosition;
window.deleteBlock = deleteBlock;
window.toggleInputSign = toggleInputSign;

