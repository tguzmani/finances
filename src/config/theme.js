import { createTheme } from '@mui/material'

const muiTheme = createTheme({})

const theme = createTheme({
  palette: {
    mode: 'dark',
  },

  typography: {
    fontFamily: 'IBM Plex Sans, Roboto, sans-serif',
  },

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
