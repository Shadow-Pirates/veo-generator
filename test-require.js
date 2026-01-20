console.log('Testing electron require...')
console.log('Node version:', process.version)
console.log('Electron version:', process.versions.electron)

try {
  const electron = require('electron')
  console.log('Electron object:', electron)
  console.log('Electron keys:', Object.keys(electron))
  console.log('Electron.app:', electron.app)
  console.log('Electron.BrowserWindow:', electron.BrowserWindow)
} catch (error) {
  console.error('Error requiring electron:', error)
}
