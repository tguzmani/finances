import { List, ListItemButton, ListItemText, ListItemIcon } from '@mui/material'
import { Link } from 'react-router-dom'
import React from 'react'

import HomeIcon from '@mui/icons-material/Home'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import BookIcon from '@mui/icons-material/Book'
import CategoryIcon from '@mui/icons-material/Category'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'

const Navigation = () => {
  const links = [
    {
      to: '/',
      label: 'Home',
      icon: HomeIcon,
    },
    {
      to: '/journal',
      label: 'Journal',
      icon: BookIcon,
    },
    {
      to: '#',
      label: 'Expenses',
      icon: AttachMoneyIcon,
    },
    {
      to: '/accounts',
      label: 'Accounts',
      icon: AccountBalanceIcon,
    },
    {
      to: '#',
      label: 'Categories',
      icon: CategoryIcon,
    },
  ]

  return (
    <List>
      {links.map(link => (
        <ListItemButton
          key={link.to}
          disabled={link.to === '#'}
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
