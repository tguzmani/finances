import { makeObservable, observable, action } from 'mobx'

class Service {
  loading = false

  constructor() {
    makeObservable(this, { loading: observable, toggleLoading: action })
  }

  toggleLoading() {
    this.loading = !this.loading
  }

  async withLoadingQuery(asyncFunction) {
    this.toggleLoading()
    const data = await asyncFunction()
    this.toggleLoading()

    return data
  }

  async withLoadingCommand(asyncFunction) {
    this.toggleLoading()
    await asyncFunction()
    this.toggleLoading()
  }
}

export default Service
