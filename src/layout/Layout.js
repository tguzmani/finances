import React from 'react'
import AppBar from './AppBar'
import { Box, Grid } from '@mui/material'
import AccountSidePanel from '../modules/accounts/views/AccountSidePanel'

const Layout = ({ children }) => {
  return (
    <>
      <AppBar />
      <Grid container>
        <Grid item xs={2}>
          Navegación
        </Grid>

        <Grid item xs={8}>
          <Box m={4}>{children}</Box>
        </Grid>

        <Grid item xs={2}>
          <AccountSidePanel />
        </Grid>
      </Grid>
    </>
  )
}

export default Layout
