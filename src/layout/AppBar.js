import React from 'react'
import MuiAppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import LogoutIcon from '@mui/icons-material/Logout'

import { useStoreActions, useStoreState } from 'easy-peasy'
import {
  Stack,
  Divider,
  MenuItem,
  Button,
  Menu,
  LinearProgress,
} from '@mui/material'
import useMenu from './hooks/useMenu'
import useCurrentPeriod from 'modules/periods/hooks/useCurrentPeriod'
import useRead from './hooks/useRead'

const AppBar = () => {
  const { signOut, toggleHideAmounts } = useStoreActions(state => state.auth)
  const { setCurrentPeriod, readPeriods } = useStoreActions(
    state => state.periods
  )

  const { hideAmounts } = useStoreState(state => state.auth)

  const { currentPeriod, periods } = useCurrentPeriod()

  const { anchorEl, handleCloseMenu, handleOpenMenu } = useMenu()

  useRead(readPeriods)

  const handleLogOut = () => {
    signOut()
  }

  const handleHideAmount = () => {
    toggleHideAmounts()
  }

  const handleSetCurrentPeriod = period => () => {
    setCurrentPeriod(period)
    handleCloseMenu()
  }

  return (
    <MuiAppBar position='sticky' elevation={0} >
      <Toolbar sx={{ bgcolor: 'grey.900' }}>
        <Typography variant='h6' component='div' sx={{ flexGrow: 1 }}>
          Finances
        </Typography>

        <Stack direction='row' spacing={1} alignItems='center'>
          <Button onClick={handleOpenMenu}>{currentPeriod?.name}</Button>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleCloseMenu}
          >
            {periods.map(period => (
              <MenuItem
                onClick={handleSetCurrentPeriod(period)}
                key={period.key}
              >
                {period.name}
              </MenuItem>
            ))}
          </Menu>

          <Divider orientation='vertical' flexItem />

          <IconButton onClick={handleHideAmount} color='inherit'>
            {hideAmounts ? <VisibilityIcon /> : <VisibilityOffIcon />}
          </IconButton>

          <IconButton onClick={handleLogOut} color='inherit'>
            <LogoutIcon />
          </IconButton>
        </Stack>
      </Toolbar>
    </MuiAppBar>
  )
}

export default AppBar
