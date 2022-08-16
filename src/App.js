import './App.scss'
import React from 'react'
import Router from './Router'

import { StoreProvider } from 'easy-peasy'
import store from './config/easy-peasy.store'

import { ThemeProvider } from '@mui/material/styles'
import theme from './config/theme'

import AdapterDateFns from '@mui/lab/AdapterDateFns'
import LocalizationProvider from '@mui/lab/LocalizationProvider'

const App = () => {
  React.useEffect(() => {
    document.title = 'React App'
  }, [])

  return (
    <StoreProvider store={store}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <ThemeProvider theme={theme}>
          <Router />
        </ThemeProvider>
      </LocalizationProvider>
    </StoreProvider>
  )
}

export default App
