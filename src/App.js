import './App.scss'
import React from 'react'
import Router from './Router'

import { StoreProvider } from 'easy-peasy'
import store from './config/easy-peasy.store'

import { ThemeProvider } from '@mui/material/styles'
import theme from './config/theme'

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { CssBaseline } from '@mui/material'

const App = () => {
  React.useEffect(() => {
    document.title = 'Finances'
  }, [])
  

  return (
    <StoreProvider store={store}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Router />
        </ThemeProvider>
      </LocalizationProvider>
    </StoreProvider>
  )
}

export default App
