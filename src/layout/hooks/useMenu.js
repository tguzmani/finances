import { useState } from 'react'

const useMenu = which => {
  const [anchorEl, setAnchorEl] = useState(null)

  const handleOpenMenu = event => {
    setAnchorEl(event.currentTarget)
  }

  const handleCloseMenu = () => {
    setAnchorEl(null)
  }

  return [anchorEl, handleOpenMenu, handleCloseMenu]
}

export default useMenu
