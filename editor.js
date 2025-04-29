const preview = document.getElementById('preview');
const roomSelect = document.getElementById('roomSelect');
const addRoomBtn = document.getElementById('addRoomBtn');
const removeRoomBtn = document.getElementById('removeRoomBtn');
const blockProps = document.getElementById('blockProps');
const propX = document.getElementById('propX');
const propY = document.getElementById('propY');
const propW = document.getElementById('propW');
const propH = document.getElementById('propH');
const propType = document.getElementById('propType');
const propTypeWrap = document.getElementById('propTypeWrap');
const deleteBlockBtn = document.getElementById('deleteBlockBtn');
const copyBtn = document.getElementById('copyBtn');
const importFile = document.getElementById('importFile');
const pasteBtn = document.getElementById('pasteBtn');
const newBtn = document.getElementById('newBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const outlineCheckbox = document.getElementById('outlineBlocks');
const autoSaveCheckbox = document.getElementById('autoSave');
const refreshBtn = document.getElementById('refreshBtn');
autoSaveCheckbox.checked = true;
let clipboard = [];
let lastMouse = {x: 0, y: 0};
let contextMenu = null;
const levelNameInput = document.getElementById('levelNameInput');
const randomMapBtn = document.getElementById('randomMapBtn');
levelNameInput.value = "My Level";
levelNameInput.addEventListener('input', () => {
    levelName = levelNameInput.value;
    saveToStorage();
});
function loadFromStorage() {
    let d = localStorage.getItem('fbedit_level');
    if (!d) return;
    try {
        let data = JSON.parse(d);
        if (data.rooms) rooms = data.rooms;
        if (typeof data.currentRoom === "number") currentRoom = data.currentRoom;
        if (typeof data.levelName === "string") levelName = data.levelName;
        levelNameInput.value = levelName;
        updateRoomSelect();
        selectedBlocks = [];
        renderBlocks();
        showBlockProps();
    } catch {}
}
const typeMap = {
    player:   { label: "P" },
    key:      { label: "K" },
    door:     { label: "D" },
    goal:     { label: "G" },
    obstacle: { label: "O" }
};
let rooms = [
    {
        name: "Room 1",
        objects: []
    }
];
let currentRoom = 0;
let selectedBlocks = [];
let dragOffset = {x:0, y:0};
let resizing = false;
let resizeStart = {x:0, y:0, w:0, h:0};
let levelName = "My Level";
let mouseDown = false;
let mouseDragStart = null;
let mouseDragRect = null;
let showOutline = true;
let undoStack = [];
let redoStack = [];
function saveToStorage() {
    if (!autoSaveCheckbox.checked) return;
    localStorage.setItem('fbedit_level', JSON.stringify({
        rooms, currentRoom, levelName
    }));
}
function loadFromStorageSimple() {
    let d = localStorage.getItem('fbedit_level');
    if (!d) return;
    try {
        let data = JSON.parse(d);
        if (data.rooms) rooms = data.rooms;
        if (typeof data.currentRoom === "number") currentRoom = data.currentRoom;
        if (typeof data.levelName === "string") levelName = data.levelName;
        updateRoomSelect();
        selectedBlocks = [];
        renderBlocks();
        showBlockProps();
    } catch {}
}
window.addEventListener('beforeunload', saveToStorage);
autoSaveCheckbox.onchange = saveToStorage;
loadFromStorage();
outlineCheckbox.checked = showOutline;
outlineCheckbox.onchange = () => { showOutline = outlineCheckbox.checked; renderBlocks(); };
settingsBtn.onclick = () => { settingsPanel.style.display = settingsPanel.style.display === "block" ? "none" : "block"; };
function updateRoomSelect() {
    roomSelect.innerHTML = '';
    rooms.forEach((r,i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = r.name;
        roomSelect.appendChild(opt);
    });
    roomSelect.value = currentRoom;
}
updateRoomSelect();
roomSelect.addEventListener('change', () => {
    currentRoom = parseInt(roomSelect.value);
    selectedBlocks = [];
    renderBlocks();
    showBlockProps();
});
addRoomBtn && (addRoomBtn.onclick = () => {
    pushUndo();
    rooms.push({
        name: "Room " + (rooms.length+1),
        objects: []
    });
    currentRoom = rooms.length-1;
    updateRoomSelect();
    renderBlocks();
    showBlockProps();
});
removeRoomBtn && (removeRoomBtn.onclick = () => {
    if (rooms.length <= 1) return;
    pushUndo();
    rooms.splice(currentRoom,1);
    currentRoom = Math.max(0, currentRoom-1);
    updateRoomSelect();
    renderBlocks();
    showBlockProps();
});
newBtn.onclick = () => {
    if (!confirm("Are you sure you want to start a new project? This will erase the current map.")) return;
    rooms = [{ name: "Room 1", objects: [] }];
    currentRoom = 0;
    selectedBlocks = [];
    undoStack = [];
    redoStack = [];
    levelName = "My Level";
    updateRoomSelect();
    renderBlocks();
    showBlockProps();
    saveToStorage();
};
document.querySelectorAll('.block').forEach(block => {
    block.addEventListener('dragstart', e => {
        e.dataTransfer.setData('type', block.dataset.type);
    });
});
refreshBtn.onclick = () => {
    loadFromStorage();
    renderBlocks();
    showBlockProps();
};
preview.addEventListener('dragover', e => e.preventDefault());
preview.addEventListener('drop', e => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    if (!typeMap[type]) return;
    let objs = rooms[currentRoom].objects;
    if (type !== "obstacle" && objs.some(o => o.type === type)) return;
    const rect = preview.getBoundingClientRect();
    let x = Math.round(e.clientX - rect.left - 20);
    let y = Math.round(e.clientY - rect.top - 20);
    const block = { type, rect: { x, y, w: 40, h: 40 }, locked: false };
    pushUndo();
    objs.push(block);
    selectedBlocks = [objs.length-1];
    renderBlocks();
    showBlockProps();
    saveToStorage();
});
function renderBlocks() {
    preview.innerHTML = '';
    let objs = rooms[currentRoom].objects;
    objs.forEach((o,i) => {
        const div = document.createElement('div');
        div.className = 'editor-block';
        div.dataset.index = i;
        if (selectedBlocks.includes(i) && showOutline) div.classList.add('selected');
        if (o.locked) div.classList.add('locked');
        div.dataset.type = o.type;
        div.style.left = o.rect.x + 'px';
        div.style.top = o.rect.y + 'px';
        div.style.width = o.rect.w + 'px';
        div.style.height = o.rect.h + 'px';
        div.textContent = typeMap[o.type].label;
        if (o.type === "obstacle") div.style.color = "#111";
        preview.appendChild(div);
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        handle.addEventListener('mousedown', e => {
            e.stopPropagation();
            const idx = parseInt(div.dataset.index);
            if (!selectedBlocks.includes(idx)) selectedBlocks = [idx];
            resizing = true;
            resizeStart = {
                x: e.clientX,
                y: e.clientY,
                w: o.rect.w,
                h: o.rect.h
            };
            document.body.style.userSelect = "none";
            showBlockProps();
        });
        div.appendChild(handle);
    });
    if (mouseDragRect) {
        const sel = document.createElement('div');
        sel.className = 'select-rect';
        sel.style.left = mouseDragRect.x + 'px';
        sel.style.top = mouseDragRect.y + 'px';
        sel.style.width = mouseDragRect.w + 'px';
        sel.style.height = mouseDragRect.h + 'px';
        preview.appendChild(sel);
    }
    if (selectedBlocks.length === 1) showShortcutMenu(selectedBlocks[0]);
    else removeShortcutMenu();
    saveToStorage();
}
function showBlockProps() {
    if (selectedBlocks.length !== 1) {
        blockProps.style.display = "none";
        return;
    }
    let o = rooms[currentRoom].objects[selectedBlocks[0]];
    if (!o) {
        blockProps.style.display = "none";
        return;
    }
    blockProps.style.display = "block";
    propX.value = o.rect.x;
    propY.value = o.rect.y;
    propW.value = o.rect.w;
    propH.value = o.rect.h;
    propType.value = o.type;
    propTypeWrap.style.display = (["player","key","door","goal","obstacle"].includes(o.type) ? "" : "none");
}
propX.oninput = () => {
    let o = rooms[currentRoom].objects[selectedBlocks[0]];
    if (!o) return;
    o.rect.x = Math.max(0, Math.min(800-o.rect.w, parseInt(propX.value)||0));
    renderBlocks();
    saveToStorage();
};
propY.oninput = () => {
    let o = rooms[currentRoom].objects[selectedBlocks[0]];
    if (!o) return;
    o.rect.y = Math.max(0, Math.min(600-o.rect.h, parseInt(propY.value)||0));
    renderBlocks();
    saveToStorage();
};
propW.oninput = () => {
    let o = rooms[currentRoom].objects[selectedBlocks[0]];
    if (!o) return;
    o.rect.w = Math.max(1, Math.min(800-o.rect.x, parseInt(propW.value)||1));
    renderBlocks();
    saveToStorage();
};
propH.oninput = () => {
    let o = rooms[currentRoom].objects[selectedBlocks[0]];
    if (!o) return;
    o.rect.h = Math.max(1, Math.min(600-o.rect.y, parseInt(propH.value)||1));
    renderBlocks();
    saveToStorage();
};
propType.onchange = () => {
    let o = rooms[currentRoom].objects[selectedBlocks[0]];
    if (!o) return;
    o.type = propType.value;
    renderBlocks();
    saveToStorage();
};
deleteBlockBtn.onclick = () => {
    if (selectedBlocks.length === 1) {
        pushUndo();
        rooms[currentRoom].objects.splice(selectedBlocks[0],1);
        selectedBlocks = [];
        renderBlocks();
        showBlockProps();
        saveToStorage();
    }
};
copyBtn.onclick = async () => {
    if (!selectedBlocks.length) return;
    let blocks = selectedBlocks.map(idx => JSON.parse(JSON.stringify(rooms[currentRoom].objects[idx])));
    clipboard = blocks;
    try {
        await navigator.clipboard.writeText(JSON.stringify(blocks, null, 2));
    } catch {}
};
pasteBtn.onclick = async () => {
    try {
        const text = await navigator.clipboard.readText();
        let data = JSON.parse(text);
        if (Array.isArray(data)) {
            let objs = rooms[currentRoom].objects;
            data.forEach(b => {
                if (b && b.type && b.rect) {
                    let newBlock = JSON.parse(JSON.stringify(b));
                    newBlock.locked = false;
                    objs.push(newBlock);
                }
            });
            selectedBlocks = [];
            for (let i=objs.length-data.length; i<objs.length; ++i) selectedBlocks.push(i);
            renderBlocks();
            showBlockProps();
            saveToStorage();
        } else if (data && data.rooms) {
            rooms = data.rooms.map(r=>({
                name: r.name || "Room",
                objects: Array.isArray(r.objects) ? r.objects.map(o=>({
                    type: o.type,
                    rect: {...o.rect},
                    locked: false
                })) : []
            }));
            levelName = data.level_name || "My Level";
            currentRoom = 0;
            updateRoomSelect();
            selectedBlocks = [];
            renderBlocks();
            showBlockProps();
            saveToStorage();
        }
    } catch (err) {
        alert("Clipboard does not contain valid JSON for blocks or level.");
    }
};
function showShortcutMenu(idx) {
    removeShortcutMenu();
    let o = rooms[currentRoom].objects[idx];
    if (!o) return;
    const menu = document.createElement('div');
    menu.className = 'shortcut-menu';
    menu.style.position = 'absolute';
    menu.style.left = (o.rect.x + o.rect.w/2 - 60) + 'px';
    menu.style.top = (o.rect.y - 36) + 'px';
    menu.innerHTML = `
        <button data-action="lock">${o.locked ? 'Unlock' : 'Lock'}</button>
        <button data-action="rotate">⟳</button>
        <button data-action="copy">Copy</button>
        <button data-action="delete">Del</button>
    `;
    menu.oncontextmenu = e => e.preventDefault();
    menu.onclick = async e => {
        if (e.target.tagName !== "BUTTON") return;
        let action = e.target.getAttribute("data-action");
        if (action === "lock") {
            o.locked = !o.locked;
            renderBlocks();
        } else if (action === "rotate") {
            let w = o.rect.w, h = o.rect.h;
            o.rect.w = h; o.rect.h = w;
            renderBlocks();
        } else if (action === "copy") {
            clipboard = [JSON.parse(JSON.stringify(o))];
            try {
                await navigator.clipboard.writeText(JSON.stringify(clipboard, null, 2));
            } catch {}
        } else if (action === "delete") {
            rooms[currentRoom].objects.splice(idx,1);
            selectedBlocks = [];
            renderBlocks();
            showBlockProps();
        }
    };
    preview.appendChild(menu);
    contextMenu = menu;
}
function removeShortcutMenu() {
    if (contextMenu && contextMenu.parentNode) contextMenu.parentNode.removeChild(contextMenu);
    contextMenu = null;
}
function showContextMenu(x, y, idx) {
    removeShortcutMenu();
    const menu = document.createElement('div');
    menu.className = 'shortcut-menu';
    menu.style.position = 'fixed';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.innerHTML = `
        <button data-action="lock">${rooms[currentRoom].objects[idx].locked ? 'Unlock' : 'Lock'}</button>
        <button data-action="rotate">⟳ Rotate</button>
        <button data-action="copy">Copy</button>
        <button data-action="delete">Delete</button>
    `;
    menu.oncontextmenu = e => e.preventDefault();
    menu.onclick = async e => {
        if (e.target.tagName !== "BUTTON") return;
        let action = e.target.getAttribute("data-action");
        let o = rooms[currentRoom].objects[idx];
        if (action === "lock") {
            o.locked = !o.locked;
            renderBlocks();
        } else if (action === "rotate") {
            let w = o.rect.w, h = o.rect.h;
            o.rect.w = h; o.rect.h = w;
            renderBlocks();
        } else if (action === "copy") {
            clipboard = [JSON.parse(JSON.stringify(o))];
            try {
                await navigator.clipboard.writeText(JSON.stringify(clipboard, null, 2));
            } catch {}
        } else if (action === "delete") {
            rooms[currentRoom].objects.splice(idx,1);
            selectedBlocks = [];
            renderBlocks();
            showBlockProps();
        }
    };
    document.body.appendChild(menu);
    contextMenu = menu;
    document.addEventListener('mousedown', hideContextMenu, {once:true});
}
function hideContextMenu() {
    removeShortcutMenu();
}
let isDragging = false;
let dragStart = null;
let dragBlockIdx = null;
preview.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target === preview) {
        mouseDown = true;
        mouseDragStart = { x: e.offsetX, y: e.offsetY };
        mouseDragRect = { x: e.offsetX, y: e.offsetY, w: 0, h: 0 };
        renderBlocks();
        showBlockProps();
        return;
    }
    const blockDiv = e.target.closest('.editor-block');
    if (blockDiv && !e.target.classList.contains('resize-handle')) {
        let idx = parseInt(blockDiv.dataset.index);
        if (!selectedBlocks.includes(idx)) selectedBlocks = [idx];
        dragBlockIdx = idx;
        dragStart = { x: e.clientX, y: e.clientY };
        isDragging = true;
        document.body.style.userSelect = "none";
    }
    if (blockDiv && e.target.classList.contains('resize-handle')) {
        let idx = parseInt(blockDiv.dataset.index);
        if (!selectedBlocks.includes(idx)) selectedBlocks = [idx];
        resizing = true;
        resizeStart = {
            x: e.clientX,
            y: e.clientY,
            w: rooms[currentRoom].objects[idx].rect.w,
            h: rooms[currentRoom].objects[idx].rect.h
        };
        document.body.style.userSelect = "none";
    }
});
window.addEventListener('mousemove', e => {
    if (mouseDown && mouseDragStart) {
        let rect = preview.getBoundingClientRect();
        let x1 = mouseDragStart.x, y1 = mouseDragStart.y;
        let x2 = e.clientX - rect.left, y2 = e.clientY - rect.top;
        let rx = Math.min(x1,x2), ry = Math.min(y1,y2);
        let rw = Math.abs(x2-x1), rh = Math.abs(y2-y1);
        mouseDragRect = { x: rx, y: ry, w: rw, h: rh };
        renderBlocks();
        return;
    }
    if (isDragging && dragBlockIdx !== null) {
        let objs = rooms[currentRoom].objects;
        let o = objs[dragBlockIdx];
        if (!o || o.locked) return;
        let dx = e.clientX - dragStart.x;
        let dy = e.clientY - dragStart.y;
        let nx = o.rect.x + dx;
        let ny = o.rect.y + dy;
        nx = Math.max(0, Math.min(800-o.rect.w, nx));
        ny = Math.max(0, Math.min(600-o.rect.h, ny));
        o.rect.x = nx;
        o.rect.y = ny;
        dragStart = { x: e.clientX, y: e.clientY };
        renderBlocks();
        showBlockProps();
        saveToStorage();
    }
    if (resizing && selectedBlocks.length === 1) {
        let idx = selectedBlocks[0];
        let o = rooms[currentRoom].objects[idx];
        if (!o || o.locked) return;
        let dx = e.clientX - resizeStart.x;
        let dy = e.clientY - resizeStart.y;
        let newW = Math.max(1, resizeStart.w + dx);
        let newH = Math.max(1, resizeStart.h + dy);
        newW = Math.min(newW, 800 - o.rect.x);
        newH = Math.min(newH, 600 - o.rect.y);
        o.rect.w = newW;
        o.rect.h = newH;
        renderBlocks();
        showBlockProps();
        saveToStorage();
    }
});
window.addEventListener('mouseup', e => {
    if (mouseDown && mouseDragRect) {
        let objs = rooms[currentRoom].objects;
        let rx = mouseDragRect.x, ry = mouseDragRect.y, rw = mouseDragRect.w, rh = mouseDragRect.h;
        selectedBlocks = [];
        objs.forEach((o,i) => {
            let bx = o.rect.x, by = o.rect.y, bw = o.rect.w, bh = o.rect.h;
            if (bx < rx+rw && bx+bw > rx && by < ry+rh && by+bh > ry) selectedBlocks.push(i);
        });
        mouseDragRect = null;
        mouseDragStart = null;
        mouseDown = false;
        renderBlocks();
        showBlockProps();
    }
    isDragging = false;
    dragBlockIdx = null;
    resizing = false;
    document.body.style.userSelect = "";
});
window.addEventListener('keydown', async e => {
    if (e.ctrlKey && e.key.toLowerCase() === 'c' && selectedBlocks.length) {
        let blocks = selectedBlocks.map(idx => JSON.parse(JSON.stringify(rooms[currentRoom].objects[idx])));
        clipboard = blocks;
        try {
            await navigator.clipboard.writeText(JSON.stringify(blocks, null, 2));
        } catch {}
        e.preventDefault();
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'v') {
        try {
            const text = await navigator.clipboard.readText();
            let data = JSON.parse(text);
            if (Array.isArray(data)) {
                let objs = rooms[currentRoom].objects;
                data.forEach(b => {
                    if (b && b.type && b.rect) {
                        let newBlock = JSON.parse(JSON.stringify(b));
                        newBlock.locked = false;
                        objs.push(newBlock);
                    }
                });
                selectedBlocks = [];
                for (let i=objs.length-data.length; i<objs.length; ++i) selectedBlocks.push(i);
                renderBlocks();
                showBlockProps();
                saveToStorage();
            } else if (data && data.rooms) {
                rooms = data.rooms.map(r=>({
                    name: r.name || "Room",
                    objects: Array.isArray(r.objects) ? r.objects.map(o=>({
                        type: o.type,
                        rect: {...o.rect},
                        locked: false
                    })) : []
                }));
                levelName = data.level_name || "My Level";
                currentRoom = 0;
                updateRoomSelect();
                selectedBlocks = [];
                renderBlocks();
                showBlockProps();
                saveToStorage();
            }
        } catch (err) {
            alert("Clipboard does not contain valid JSON for blocks or level.");
        }
        e.preventDefault();
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        undo();
        e.preventDefault();
        return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        redo();
        e.preventDefault();
        return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && selectedBlocks.length) {
        pushUndo();
        deleteSelected();
        saveToStorage();
        e.preventDefault();
        return;
    }
    let step = e.shiftKey ? 1 : 10;
    let dx = 0, dy = 0;
    if (e.key === 'a' || e.key === 'A' || e.key === "ArrowLeft") dx = -step;
    if (e.key === 'd' || e.key === 'D' || e.key === "ArrowRight") dx = step;
    if (e.key === 'w' || e.key === 'W' || e.key === "ArrowUp") dy = -step;
    if (e.key === 's' || e.key === 'S' || e.key === "ArrowDown") dy = step;
    if (dx !== 0 || dy !== 0) {
        let objs = rooms[currentRoom].objects;
        selectedBlocks.forEach(idx => {
            let o = objs[idx];
            if (!o || o.locked) return;
            let nx = o.rect.x + dx, ny = o.rect.y + dy;
            nx = Math.max(0, Math.min(800-o.rect.w, nx));
            ny = Math.max(0, Math.min(600-o.rect.h, ny));
            o.rect.x = nx;
            o.rect.y = ny;
        });
        showBlockProps();
        renderBlocks();
        saveToStorage();
        e.preventDefault();
    }
});
function pushUndo() {
    undoStack.push(JSON.stringify({rooms, currentRoom}));
    redoStack = [];
}
function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify({rooms, currentRoom}));
    let state = JSON.parse(undoStack.pop());
    rooms = JSON.parse(JSON.stringify(state.rooms));
    currentRoom = state.currentRoom;
    updateRoomSelect();
    selectedBlocks = [];
    renderBlocks();
    showBlockProps();
}
function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify({rooms, currentRoom}));
    let state = JSON.parse(redoStack.pop());
    rooms = JSON.parse(JSON.stringify(state.rooms));
    currentRoom = state.currentRoom;
    updateRoomSelect();
    selectedBlocks = [];
    renderBlocks();
    showBlockProps();
}
function deleteSelected() {
    let objs = rooms[currentRoom].objects;
    selectedBlocks.sort((a,b)=>b-a).forEach(idx => {
        objs.splice(idx,1);
    });
    selectedBlocks = [];
    renderBlocks();
    showBlockProps();
    saveToStorage();
}
function randomMap() {
    levelName = "Random Level " + Math.floor(Math.random()*10000);
    levelNameInput.value = levelName;
    const roomCount = Math.floor(Math.random()*3)+1;
    rooms = [];
    for(let r=0; r<roomCount; ++r) {
        let objects = [];
        ["player","key","door","goal"].forEach(type=>{
            objects.push({
                type,
                rect: {
                    x: Math.floor(Math.random()*700+20),
                    y: Math.floor(Math.random()*500+20),
                    w: 40,
                    h: 40
                },
                locked: false
            });
        });
        const obsCount = Math.floor(Math.random()*5)+2;
        for(let i=0;i<obsCount;++i) {
            objects.push({
                type: "obstacle",
                rect: {
                    x: Math.floor(Math.random()*760),
                    y: Math.floor(Math.random()*560),
                    w: Math.floor(Math.random()*60)+20,
                    h: Math.floor(Math.random()*60)+20
                },
                locked: false
            });
        }
        rooms.push({
            name: "Room " + (r+1),
            objects
        });
    }
    currentRoom = 0;
    selectedBlocks = [];
    updateRoomSelect();
    renderBlocks();
    showBlockProps();
    saveToStorage();
}
randomMapBtn.onclick = randomMap;
preview.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target === preview) {
        mouseDown = true;
        mouseDragStart = { x: e.offsetX, y: e.offsetY };
        mouseDragRect = { x: e.offsetX, y: e.offsetY, w: 0, h: 0 };
        renderBlocks();
        showBlockProps();
        return;
    }
    const blockDiv = e.target.closest('.editor-block');
    if (blockDiv && !e.target.classList.contains('resize-handle')) {
        let idx = parseInt(blockDiv.dataset.index);
        if (!selectedBlocks.includes(idx)) selectedBlocks = [idx];
        dragBlockIdx = idx;
        dragStart = { x: e.clientX, y: e.clientY };
        isDragging = true;
        document.body.style.userSelect = "none";
    }
    if (blockDiv && e.target.classList.contains('resize-handle')) {
        let idx = parseInt(blockDiv.dataset.index);
        if (!selectedBlocks.includes(idx)) selectedBlocks = [idx];
        resizing = true;
        resizeStart = {
            x: e.clientX,
            y: e.clientY,
            w: rooms[currentRoom].objects[idx].rect.w,
            h: rooms[currentRoom].objects[idx].rect.h
        };
        document.body.style.userSelect = "none";
    }
});
preview.addEventListener('mousemove', e => {
    if (isDragging && dragBlockIdx !== null) {
        let objs = rooms[currentRoom].objects;
        let o = objs[dragBlockIdx];
        if (!o || o.locked) return;
        let dx = e.clientX - dragStart.x;
        let dy = e.clientY - dragStart.y;
        let nx = o.rect.x + dx;
        let ny = o.rect.y + dy;
        nx = Math.max(0, Math.min(800-o.rect.w, nx));
        ny = Math.max(0, Math.min(600-o.rect.h, ny));
        o.rect.x = nx;
        o.rect.y = ny;
        dragStart = { x: e.clientX, y: e.clientY };
        renderBlocks();
        showBlockProps();
        saveToStorage();
    }
});
window.addEventListener('mousemove', e => {
    if (mouseDown && mouseDragStart) {
        let rect = preview.getBoundingClientRect();
        let x1 = mouseDragStart.x, y1 = mouseDragStart.y;
        let x2 = e.clientX - rect.left, y2 = e.clientY - rect.top;
        let rx = Math.min(x1,x2), ry = Math.min(y1,y2);
        let rw = Math.abs(x2-x1), rh = Math.abs(y2-y1);
        mouseDragRect = { x: rx, y: ry, w: rw, h: rh };
        renderBlocks();
        return;
    }
    if (resizing && selectedBlocks.length === 1) {
        let idx = selectedBlocks[0];
        let o = rooms[currentRoom].objects[idx];
        if (!o || o.locked) return;
        let dx = e.clientX - resizeStart.x;
        let dy = e.clientY - resizeStart.y;
        let newW = Math.max(1, resizeStart.w + dx);
        let newH = Math.max(1, resizeStart.h + dy);
        newW = Math.min(newW, 800 - o.rect.x);
        newH = Math.min(newH, 600 - o.rect.y);
        o.rect.w = newW;
        o.rect.h = newH;
        renderBlocks();
        showBlockProps();
        saveToStorage();
    }
});
window.addEventListener('mouseup', e => {
    if (mouseDown && mouseDragRect) {
        let objs = rooms[currentRoom].objects;
        let rx = mouseDragRect.x, ry = mouseDragRect.y, rw = mouseDragRect.w, rh = mouseDragRect.h;
        selectedBlocks = [];
        objs.forEach((o,i) => {
            let bx = o.rect.x, by = o.rect.y, bw = o.rect.w, bh = o.rect.h;
            if (bx < rx+rw && bx+bw > rx && by < ry+rh && by+bh > ry) selectedBlocks.push(i);
        });
        mouseDragRect = null;
        mouseDragStart = null;
        mouseDown = false;
        renderBlocks();
        showBlockProps();
    }
    isDragging = false;
    dragBlockIdx = null;
    resizing = false;
    document.body.style.userSelect = "";
});