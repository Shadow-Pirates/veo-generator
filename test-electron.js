const { app } = require('electron')
console.log('Electron app:', app)
console.log('Electron app.whenReady:', app?.whenReady)
app.whenReady().then(() => {
  console.log('Electron is ready!')
  app.quit()
})
