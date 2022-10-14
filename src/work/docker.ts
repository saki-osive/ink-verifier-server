import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { FastifyBaseLogger } from 'fastify'
import { CACHES_DIR, DOCKER_RUN_PARAMS, MAX_CONTAINERS, VERIFIER_IMAGE } from '../config'
import workContext, { WorkContext } from './context'

interface RunOptions {
  processingDir: string,
  successHandler: () => void,
  errorHandler: () => void
}

class Docker {
  log: FastifyBaseLogger
  context: WorkContext

  constructor ({ log }: {log: FastifyBaseLogger}) {
    this.log = log
    this.context = workContext
  }

  /**
   * Runs a verifier docker container.
   */
  run ({ processingDir, successHandler, errorHandler }: RunOptions) {
    const params = [
      'run',
      '--rm',
      '--cidfile', path.resolve(processingDir, 'cid'),
      '--security-opt=no-new-privileges',
      // https://man7.org/linux/man-pages/man7/capabilities.7.html
      '--cap-drop', 'all'
    ]
    if (DOCKER_RUN_PARAMS !== undefined) {
      params.push(...DOCKER_RUN_PARAMS.split(' '))
    }
    params.push(...[
      '-v', `${processingDir}:/build`,
      '-v', `${path.resolve(CACHES_DIR, '.cache')}:/root/.cache`,
      '-v', `${path.resolve(CACHES_DIR, '.cargo', 'registry')}:/usr/local/cargo/registry`,
      '-v', `${path.resolve(CACHES_DIR, '.rustup')}:/usr/local/rustup`,
      VERIFIER_IMAGE
    ])

    const out = fs.openSync(path.resolve(processingDir, 'out.log'), 'a')
    const err = fs.openSync(path.resolve(processingDir, 'out.log'), 'a')

    // Note that parent will wait the sub-process to finish
    const p = spawn('docker', params, {
      detached: true,
      stdio: ['ignore', out, err]
    })

    this.log.info(`Running verification (${p.pid})`)

    this.context.addProc(p)

    p.on('close', (code) => {
      this.log.info(`${p.pid} exit ${code}`)

      this.context.rmProc(p)

      if (code === 0) {
        successHandler()
      } else {
        errorHandler()
      }
    })
  }

  async canRunMore () {
    return this.context.runningProcs <= MAX_CONTAINERS
  }
}

export default Docker
