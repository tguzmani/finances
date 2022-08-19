import { Typography } from '@mui/material'
import React from 'react'

const PageHeader = ({ children }) => {
  return (
    <Typography my={3} variant='h2'>
      {children}
    </Typography>
  )
}

export default PageHeader
