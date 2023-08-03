import { Typography } from '@mui/material'
import React from 'react'

const PageHeader = ({ children }) => {
  return (
    <Typography my={3} variant='h3'>
      {children}
    </Typography>
  )
}

export default PageHeader
