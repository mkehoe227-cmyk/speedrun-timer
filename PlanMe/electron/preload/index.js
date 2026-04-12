// Preload — will be expanded in Task 5
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('planme', {})
