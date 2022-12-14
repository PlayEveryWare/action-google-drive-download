import * as fs from 'fs'
import * as os from 'os'
import * as core from '@actions/core'
import axios, { ResponseType } from 'axios'

function parseFileIdFromURL(path?: string) : string | undefined {
  if (!path) {
    return undefined
  }

  // Ensure the file path matches a Google Drive path
  const prefix = '/file/d/'
  const suffix = '/view'

  const urlPath = new URL(path).pathname
  if (!urlPath.startsWith(prefix) || !urlPath.endsWith(suffix)) {
    core.error(`file-url path seems ill-formed: ${path})`)
    return undefined
  }

  // Strip the prefix/suffix to get the file id
  const fileId = urlPath.slice(prefix.length, -suffix.length)
  return fileId
}

async function run() : Promise<void> {

  core.saveState('isPost', true)

  const token = core.getInput('token')
  if (!token) {
    core.setFailed('No access token provided to action')
    return
  }

  const fileId = core.getInput('file-id') || parseFileIdFromURL(core.getInput('file-url'))
  if (!fileId) {
    core.setFailed('Action could not determine file id')
    return
  }

  const path = core.getInput('path')
  if (!path) {
    core.setFailed('No path provided to action')
    return
  }

  // Query Google Drive
  const fileUrl = `https://www.googleapis.com/drive/v3/files/${fileId}`

  const options = {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/octet-stream',
    },
    params: {
      alt: 'media',
      supportsAllDrives: true,
    },
    responseType: 'stream' as ResponseType,
  }

  const response = await axios.get(fileUrl, options)
  if (response.status != 200) {
    core.setFailed(`Failed to get file from Google drive: ${response.status}`)
    return
  }

  core.saveState('path', path)

  // Write file out
  const file = fs.createWriteStream(path)
  response.data.pipe(file)
}

async function post() : Promise<void> {

  // Remove the downloaded file
  const path = core.getState('path')
  if (path && fs.existsSync(path)) {
    fs.rmSync(path)
    console.log(`Removed downloaded file ${path}`)
  }
}

if (!core.getState('isPost')) {
  run()
} else {
  post()
}
