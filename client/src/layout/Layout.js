import React from 'react'
import AppBar from './AppBar'
import Box from '@mui/material/Box'

const Layout = ({ children }) => {
  return (
    <>
      <AppBar />
      <Box my={4}>{children}</Box>
    </>
  )
}

export default Layout
