import { List, ListItemButton, ListItemText, ListItemIcon } from '@mui/material'
import { Link } from 'react-router-dom'
import React from 'react'

import HomeIcon from '@mui/icons-material/Home'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import BookIcon from '@mui/icons-material/Book'
import CategoryIcon from '@mui/icons-material/Category'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import { useLocation } from 'react-router-dom'

const Navigation = () => {
  const { pathname } = useLocation()

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
      to: '/categories',
      label: 'Categories',
      icon: CategoryIcon,
    },
  ]

  const isSelected = link => {
    return link.to === pathname
  }

  return (
    <List>
      {links.map(link => (
        <ListItemButton
          key={link.to}
          disabled={link.to === '#'}
          sx={{
            borderRadius: 1,
            marginBottom: '0.25rem',
            bgcolor: isSelected(link) ? 'grey.900' : 'inherit',
          }}
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
