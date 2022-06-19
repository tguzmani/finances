import './App.scss'
import React from 'react'
import Router from './Router'

import { Provider } from 'react-redux'
import store from './config/redux.store'

import { ThemeProvider } from '@mui/material/styles'
import theme from './config/theme'

import AdapterDateFns from '@mui/lab/AdapterDateFns'
import LocalizationProvider from '@mui/lab/LocalizationProvider'

const App = () => {
  React.useEffect(() => {
    document.title = 'React App'
  }, [])

  return (
    <Provider store={store}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <ThemeProvider theme={theme}>
          <Router />
        </ThemeProvider>
      </LocalizationProvider>
    </Provider>
  )
}

export default App
