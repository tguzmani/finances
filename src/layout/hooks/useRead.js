import { useEffect } from 'react'

const useRead = (...functions) => {
  useEffect(() => {
    functions.forEach(fn => fn())
  }, [])
}

export default useRead
