import React from 'react'
import MuiAppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useDispatch } from 'react-redux'
import { signOut } from '../modules/users/users.auth.actions'

const AppBar = () => {
  const dispatch = useDispatch()

  const handleLogOut = () => {
    dispatch(signOut())
  }
  return (
    <MuiAppBar position='sticky'>
      <Toolbar>
        <Typography variant='h6' component='div' sx={{ flexGrow: 1 }}>
          Tom Front-end
        </Typography>

        <Button onClick={handleLogOut} color='inherit'>
          Logout
        </Button>
      </Toolbar>
    </MuiAppBar>
  )
}

export default AppBar
