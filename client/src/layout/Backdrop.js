import React from 'react'
import CircularProgress from '@mui/material/CircularProgress'
import MuiBackdrop from '@mui/material/Backdrop'

const Backdrop = ({ open }) => {
  return (
    <MuiBackdrop
      sx={{ color: '#fff', zIndex: theme => theme.zIndex.drawer + 1 }}
      open={open}
    >
      <CircularProgress color='inherit' />
    </MuiBackdrop>
  )
}

export default Backdrop
