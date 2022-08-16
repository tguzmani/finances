import React from 'react'
import MuiAppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'

import { useStoreActions, useStoreState } from 'easy-peasy'

const AppBar = () => {
  const { signOut, toggleHideAmounts } = useStoreActions(state => state.auth)
  const { hideAmounts } = useStoreState(state => state.auth)

  const handleLogOut = () => {
    signOut()
  }

  const handleHideAmount = () => {
    toggleHideAmounts()
  }

  return (
    <MuiAppBar position='sticky' elevation={0}>
      <Toolbar>
        <Typography variant='h6' component='div' sx={{ flexGrow: 1 }}>
          Finances
        </Typography>

        <IconButton onClick={handleHideAmount} color='inherit'>
          {hideAmounts ? <VisibilityIcon /> : <VisibilityOffIcon />}
        </IconButton>
      </Toolbar>
    </MuiAppBar>
  )
}

export default AppBar
