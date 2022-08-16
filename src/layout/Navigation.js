import { List, ListItemButton, ListItemText, ListItemIcon } from '@mui/material'
import { Link } from 'react-router-dom'
import React from 'react'

import HomeIcon from '@mui/icons-material/Home'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'

const Navigation = () => {
  const links = [
    {
      to: '/',
      label: 'Home',
      icon: HomeIcon,
    },
    {
      to: '/accounts',
      label: 'Accounts',
      icon: AccountBalanceIcon,
    },
  ]

  return (
    <List>
      {links.map(link => (
        <ListItemButton
          sx={{ borderRadius: '4px', marginBottom: '0.25rem' }}
          component={Link}
          to={link.to}
        >
          <ListItemIcon>
            <link.icon />
          </ListItemIcon>
          <ListItemText>{link.label}</ListItemText>
        </ListItemButton>
      ))}
    </List>
  )
}

export default Navigation
