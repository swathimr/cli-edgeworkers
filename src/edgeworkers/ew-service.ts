import * as envUtils from '../utils/env-utils';
import * as cliUtils from '../utils/cli-utils';
import * as httpEdge from '../cli-httpRequest';
import * as error from './ew-error';
import * as fs from 'fs';

const EDGEWORKERS_API_BASE = '/edgeworkers/v1';

// This is only for fetching tarball bodies
function fetchTarball(pth: string, method: string, body, headers, downloadPath: string) {
  const edge = envUtils.getEdgeGrid();
  var path = pth;
  var qs: string = "&";
  let accountKey = httpEdge.accountKey;
  if (accountKey) {
    // Check if query string already included in path, if not use ? otherwise use &
    if (path.indexOf("?") == -1)
      qs = "?";
    path += `${qs}accountSwitchKey=${accountKey}`;
  }

  return new Promise<any>(
    (resolve, reject) => {

      edge.auth({
        path,
        method,
        headers,
        body,
        encoding: null
      });

      edge.send(function (error, response, body) {
        if (error) {
          reject(error);
        }
        else if (httpEdge.isOkStatus(response.statusCode)) {
          var contentType = response.headers['content-type'];
          if (contentType.indexOf('gzip') > -1) {
            const buffer = Buffer.from(body, 'utf8');
            fs.writeFileSync(downloadPath, buffer);
            resolve({state: true});
          }
          else {
            // this shouldn't happen unless Version API changes content-types to non-tarball format
            throw new Error(`ERROR: Unexpected content-type: ${contentType}`);
          }
        }
        else {
          try {
            var errorObj = JSON.parse(body);
            reject(cliUtils.toJsonPretty(errorObj));
          }
          catch (ex) {
            console.error(`got error code: ${response.statusCode} calling ${method} ${path}\n${body}`);
            reject(body);
          }
        }
      });
    });
}

function postTarball(path: string, edgeworkerTarballPath) {
  return httpEdge.sendEdgeRequest(path, 'POST', new Uint8Array(fs.readFileSync(edgeworkerTarballPath, { encoding: null })), {
    'Content-Type': 'application/gzip'
  });
}

function getTarball(path: string, downloadPath: string) {
  return fetchTarball(path, 'GET', '', {}, downloadPath);
}

export function getGroup(groupId: string) {
  return httpEdge.getJson(`${EDGEWORKERS_API_BASE}/groups/${groupId}`).then(r => r.body);
}

export function getAllGroups() {
  return httpEdge.getJson(`${EDGEWORKERS_API_BASE}/groups`).then(r => r.body);
}

export function getEdgeWorkerId(ewId: string) {
  return httpEdge.getJson(`${EDGEWORKERS_API_BASE}/ids/${ewId}`).then(r => r.body);
}

export function getAllEdgeWorkerIds(groupId?: string, resourceTierId?: string) {
  var qs: string = "";
  if (groupId != undefined || groupId != null) {
    qs += `?groupId=${groupId}`
  }
  if (resourceTierId != undefined) {
    qs += (groupId == undefined) ? "?" : "&";
    qs += `resourceTierId=${resourceTierId}`;
  }
  return httpEdge.getJson(`${EDGEWORKERS_API_BASE}/ids${qs}`).then(r => r.body).catch(err => error.handleError(err,"LISTALL_EW"));
}

export function createEdgeWorkerId(groupId: string, name: string, resourceTierId: string) {
  var body = { "groupId": groupId, "name": name, "resourceTierId": resourceTierId};
  return httpEdge.postJson(`${EDGEWORKERS_API_BASE}/ids`, body).then(r => r.body).catch(err => error.handleError(err,"REGISTER_EW"));
}

export function getContracts() {
  return httpEdge.getJson(`${EDGEWORKERS_API_BASE}/contracts`).then(r => r.body).catch(err => error.handleError(err,"GET_CONTRACT"));
}

export function getResourceTiers(contractId: string) {
  return httpEdge.getJson(`${EDGEWORKERS_API_BASE}/resource-tiers?contractId=${contractId}`).then(r => r.body).catch(err => error.handleError(err,"GET_RESTIER"));
}

export function getResourceTierForEwid(ewId: string) {
  return httpEdge.getJson(`${EDGEWORKERS_API_BASE}/ids/${ewId}/resource-tier`).then(r => r.body).catch(err => error.handleError(err,"GET_RESTR_FOR_EW"));
}

export function updateEdgeWorkerId(ewId: string, groupId: string, name: string, resourceTierId: string) {
  var body = { "groupId": groupId, "name": name };
  if (resourceTierId != undefined && resourceTierId != null) {
    body["resourceTierId"] = resourceTierId;
  }
  return httpEdge.putJson(`${EDGEWORKERS_API_BASE}/ids/${ewId}`, body).then(r => r.body).catch(err => error.handleError(err,"UPDATE_EW"));
}

export function getAllVersions(ewId: string) {
  return httpEdge.getJson(`${EDGEWORKERS_API_BASE}/ids/${ewId}/versions`).then(r => r.body);
}

export function getVersionId(ewId: string, versionId: string) {
  return httpEdge.getJson(`${EDGEWORKERS_API_BASE}/ids/${ewId}/versions/${versionId}`).then(r => r.body);
}

export function uploadTarball(ewId: string, tarballPath: string) {
  return postTarball(`${EDGEWORKERS_API_BASE}/ids/${ewId}/versions`, tarballPath).then(r => r.body);
}

export function downloadTarball(ewId: string, versionId: string, downloadPath: string) {
  return getTarball(`${EDGEWORKERS_API_BASE}/ids/${ewId}/versions/${versionId}/content`, downloadPath).then(r => r.state);
}

export function getAllActivations(ewId: string) {
  return httpEdge.getJson(`${EDGEWORKERS_API_BASE}/ids/${ewId}/activations`).then(r => r.body);
}

export function getActivationID(ewId: string, activationId: string) {
  return httpEdge.getJson(`${EDGEWORKERS_API_BASE}/ids/${ewId}/activations/${activationId}`).then(r => r.body);
}

export function getVersionActivations(ewId: string, versionId: string) {
  var qs: string = "?version=";
  if (versionId === undefined || versionId === null) {
    qs = '';
    versionId = '';
  }
  return httpEdge.getJson(`${EDGEWORKERS_API_BASE}/ids/${ewId}/activations${qs}${versionId}`).then(r => r.body);
}

export function createActivationId(ewId: string, network: string, versionId: string) {
  var body = { "network": network, "version": versionId };
  return httpEdge.postJson(`${EDGEWORKERS_API_BASE}/ids/${ewId}/activations`, body).then(r => r.body);
}

export function cloneEdgeworker(ewId: string, name: string, groupId: string, resourceTierId: string) {
  let body = { "resourceTierId": resourceTierId };
  if (groupId != undefined) {
    body["groupId"] = groupId;
  }
  if (name != undefined) {
    body["name"] = name;
  }
  return httpEdge.postJson(`${EDGEWORKERS_API_BASE}/ids/${ewId}/clone`, body).then(r => r.body).catch(err => error.handleError(err,"CLONE_EW"));
}

export function validateTarball(tarballPath: string) {
  return postTarball(`${EDGEWORKERS_API_BASE}/validations`, tarballPath).then(r => r.body);
}

export function deactivateEdgeworker(ewId: string, network: string, versionId: string) {
  var body = { "network": network, "version": versionId };
  return httpEdge.postJson(`${EDGEWORKERS_API_BASE}/edgeworkers/${ewId}/deactivations`, body).then(r => r.body);
}
