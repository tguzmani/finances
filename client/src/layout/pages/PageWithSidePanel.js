import { Grid } from '@mui/material'
import React from 'react'

const PageWithSidePanel = ({ children, SidePanel }) => {
  return (
    <>
      <Grid container spacing={4}>
        <Grid xs={9} item>
          {children}
        </Grid>
        <Grid mt={3} xs={3} item>
          <SidePanel />
        </Grid>
      </Grid>
    </>
  )
}

export default PageWithSidePanel
