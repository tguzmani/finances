import React from 'react'
import { Paper, Box } from '@mui/material'

const SidePanel = ({ children }) => {
  return (
    <Box margin={1} sx={{ position: 'fixed', width: 1 / 6 }}>
      <Paper square variant='outlined' sx={{ width: '100%' }}>
        <Box padding={2} sx={{ height: '85vh' }}>
          {children}
        </Box>
      </Paper>
    </Box>
  )
}

export default SidePanel
