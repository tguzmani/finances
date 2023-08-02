import { createTheme } from '@mui/material'

const muiTheme = createTheme({})

const theme = createTheme({
  palette: {
    mode: 'dark',
  },

  typography: {},

  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          '&.table-container': { boxShadow: 'none' },
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td': { border: 0 },
        },
      },
    },
  },
})

export default theme
