import React from 'react'
import AppBar from './AppBar'
import Navigation from './Navigation'
import { Box, Grid } from '@mui/material'
import SidePanel from './SidePanel'

const Layout = ({ children }) => {
  return (
    <>
      <AppBar />
      <Grid container>
        <Grid my={3} px={3} item xs={2}>
          <Navigation />
        </Grid>

        <Grid item xs={10}>
          <Box>{children}</Box>
        </Grid>
      </Grid>
    </>
  )
}

export default Layout
