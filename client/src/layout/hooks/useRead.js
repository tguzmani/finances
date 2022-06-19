import { useEffect } from 'react'
import { useDispatch } from 'react-redux'

const useRead = (...functions) => {
  const dispatch = useDispatch()

  useEffect(() => {
    functions.forEach(fn => dispatch(fn()))
  }, [])
}

export default useRead
