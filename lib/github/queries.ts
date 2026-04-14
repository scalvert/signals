export const ORG_REPOS_QUERY = `
  query OrgRepos($org: String!, $cursor: String) {
    organization(login: $org) {
      repositories(
        first: 20
        after: $cursor
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        pageInfo { hasNextPage endCursor }
        nodes {
          databaseId
          name
          nameWithOwner
          description
          url
          isPrivate
          primaryLanguage { name }
          stargazerCount
          forkCount
          issues(states: OPEN) { totalCount }
          pullRequests(states: OPEN) { totalCount }
          defaultBranchRef {
            target {
              ... on Commit { committedDate }
            }
          }
          latestRelease { publishedAt }
          licenseInfo { key }
          contributingFile: object(expression: "HEAD:CONTRIBUTING.md") { id }
          workflowsDir: object(expression: "HEAD:.github/workflows") { id }
        }
      }
    }
  }
`

export const USER_REPOS_QUERY = `
  query UserRepos($user: String!, $cursor: String) {
    user(login: $user) {
      repositories(
        first: 20
        after: $cursor
        ownerAffiliations: OWNER
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        pageInfo { hasNextPage endCursor }
        nodes {
          databaseId
          name
          nameWithOwner
          description
          url
          isPrivate
          primaryLanguage { name }
          stargazerCount
          forkCount
          issues(states: OPEN) { totalCount }
          pullRequests(states: OPEN) { totalCount }
          defaultBranchRef {
            target {
              ... on Commit { committedDate }
            }
          }
          latestRelease { publishedAt }
          licenseInfo { key }
          contributingFile: object(expression: "HEAD:CONTRIBUTING.md") { id }
          workflowsDir: object(expression: "HEAD:.github/workflows") { id }
        }
      }
    }
  }
`

export const SINGLE_REPO_QUERY = `
  query SingleRepo($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      databaseId
      name
      nameWithOwner
      description
      url
      isPrivate
      primaryLanguage { name }
      stargazerCount
      forkCount
      issues(states: OPEN) { totalCount }
      pullRequests(states: OPEN) { totalCount }
      defaultBranchRef {
        target {
          ... on Commit { committedDate }
        }
      }
      latestRelease { publishedAt }
      licenseInfo { key }
      contributingFile: object(expression: "HEAD:CONTRIBUTING.md") { id }
      workflowsDir: object(expression: "HEAD:.github/workflows") { id }
    }
  }
`

export const ORG_PRS_QUERY = `
  query OrgPRs($org: String!, $cursor: String) {
    organization(login: $org) {
      repositories(first: 50, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          nameWithOwner
          pullRequests(states: OPEN, first: 50, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes {
              number
              title
              url
              isDraft
              createdAt
              updatedAt
              author { login }
              authorAssociation
              commits(last: 1) {
                nodes {
                  commit {
                    statusCheckRollup { state }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`

export const USER_PRS_QUERY = `
  query UserPRs($user: String!, $cursor: String) {
    user(login: $user) {
      repositories(first: 50, after: $cursor, ownerAffiliations: OWNER) {
        pageInfo { hasNextPage endCursor }
        nodes {
          nameWithOwner
          pullRequests(states: OPEN, first: 50, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes {
              number
              title
              url
              isDraft
              createdAt
              updatedAt
              author { login }
              authorAssociation
              commits(last: 1) {
                nodes {
                  commit {
                    statusCheckRollup { state }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`

export const SINGLE_REPO_PRS_QUERY = `
  query SingleRepoPRs($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      nameWithOwner
      pullRequests(states: OPEN, first: 50, orderBy: { field: UPDATED_AT, direction: DESC }) {
        nodes {
          number
          title
          url
          isDraft
          createdAt
          updatedAt
          author { login }
          authorAssociation
          commits(last: 1) {
            nodes {
              commit {
                statusCheckRollup { state }
              }
            }
          }
        }
      }
    }
  }
`
