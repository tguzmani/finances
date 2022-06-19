import usersAuthTypes from './users.auth.types'

const initialState = {
  loading: true,
  message: null,
  isAuthenticated: false,
  user: null,
}

const usersAuthReducer = (state = initialState, action) => {
  switch (action.type) {
    case usersAuthTypes.LOADING:
      return { ...state, loading: action.payload }

    case usersAuthTypes.SIGN_IN:
    case usersAuthTypes.READ_USER_BY_ID:
      console.log('user', action.payload)
      return {
        ...state,
        loading: false,
        isAuthenticated: true,
        user: action.payload,
      }

    case usersAuthTypes.ERROR:
      return {
        ...state,
        loading: false,
        isAuthenticated: false,
        user: null,
        message: { text: action.payload, severity: 'error' },
      }

    case usersAuthTypes.SIGN_OUT:
      return {
        ...state,
        loading: false,
        isAuthenticated: false,
        user: null,
      }

    case usersAuthTypes.CREATE_USER:
      return {
        ...state,
        loading: false,
      }

    default:
      return state
  }
}

export default usersAuthReducer
