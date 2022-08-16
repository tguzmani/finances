import { createTheme } from '@mui/material'

const muiTheme = createTheme({})

const theme = createTheme({
  palette: {},

  typography: {},

  components: {
    // MuiButton: {
    //   styleOverrides: {
    //     root: {
    //       borderRadius: 0,
    //     },
    //   },
    // },
    MuiPaper: {
      styleOverrides: {
        root: {
          '&.table-container': { boxShadow: 'none' },
        },
      },
    },
  },
})

export default theme
