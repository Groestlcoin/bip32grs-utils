const Account = require('../account')
const Chain = require('../chain')
const test = require('tape')

const f = require('./fixtures/account')
f.allAddresses = [].concat.apply([], f.addresses)

function blankAccount (json) {
  const account = Account.fromJSON(json)
  const chains = account.chains.map(function (chain) {
    return new Chain(chain.__parent, 0)
  })

  return new Account(chains)
}

test('containsAddress', function (t) {
  const account = Account.fromJSON(f.neutered.json)

  f.allAddresses.forEach(function (address) {
    t.equal(account.containsAddress(address), true, 'returns true for known chain address')
  })

  t.equal(account.containsAddress('mpFZW4A9QtRuSpuh9SmeW7RSzFE3XL3FQp'), false, 'returns false for unknown address')
  t.end()
})

test('clone', function (t) {
  const account = Account.fromJSON(f.neutered.json)
  const clone = account.clone()

  // by reference
  t.equal(account.chains.length, clone.chains.length, 'same number of chains')
  t.notEqual(account.chains, clone.chains, 'chain arrays are different arrays')
  t.same(account.chains, clone.chains, 'chains are deep copied')
  for (let i = 0; i < account.chains.length; ++i) {
    t.notEqual(account.chains[i], clone.chains[i], 'chains are different objects')
  }

  account.nextChainAddress(1)
  t.notSame(account.chains, clone.chains, 'chains now diverge, 1 has an extra address')
  t.end()
})

test('discoverChain', function (t) {
  const account = Account.fromJSON(f.neutered.json)
  const before = account.getChainAddress(0)
  const after = account.getChain(0).clone().next()

  t.test('does not mutate the chain during discovery', function (t) {
    t.plan(2)

    account.discoverChain(0, 20, function (addresses, callback) {
      const tmpAddrs = addresses.map(function (address) {
        // account.containsAddress would return true if internally the chain was iterating
        return address !== before && account.containsAddress(address)
      })

      const addrs = {}

      for (const add in tmpAddrs) {
        addrs[addresses[add]] = tmpAddrs[add]
      }

      return callback(null, addrs)
    }, function (err) {
      t.ifErr(err, 'no error')
      t.equal(account.getChainAddress(0), before, 'internal chain was unchanged')
    })
  })

  t.test('does mutate the chain post-discovery', function (t) {
    t.plan(2)

    account.discoverChain(0, 20, function (addresses, callback) {
      const tmpAddrs = addresses.map(function (address) {
        // account.containsAddress would return true if internally the chain was iterating
        return account.containsAddress(address)
      })

      const addrs = {}

      for (const add in tmpAddrs) {
        addrs[addresses[add]] = tmpAddrs[add]
      }

      return callback(null, addrs)
    }, function (err) {
      t.ifErr(err, 'no error')
      t.equal(account.getChainAddress(0), after, 'internal chain iterated forward one address')
    })
  })
})

test('getAllAddresses', function (t) {
  const account = blankAccount(f.neutered.json)

  t.plan(2)
  t.equal(account.getAllAddresses().length, 2, 'returns only 2 addresses post-construction')

  // iterate the chains
  f.addresses.forEach(function (a, i) {
    for (let j = 1; j < a.length; ++j) account.nextChainAddress(i)
  })

  t.same(account.getAllAddresses(), f.allAddresses, 'returns all derived addresses')
})

test('getChainAddress', function (t) {
  const account = blankAccount(f.neutered.json)

  f.addresses.forEach(function (addresses, i) {
    addresses.forEach(function (address) {
      t.equal(account.getChainAddress(i), address, 'matches the latest chain address')
      account.nextChainAddress(i)
    })
  })

  t.end()
})

test('getNetwork', function (t) {
  const account = Account.fromJSON(f.neutered.json)

  t.plan(1)
  t.equal(account.getNetwork(), account.chains[0].__parent.network, 'matches keyPair network')
})

test('isChainAddress', function (t) {
  const account = Account.fromJSON(f.neutered.json)

  f.addresses.forEach(function (addresses, i) {
    addresses.forEach(function (address) {
      t.equal(account.isChainAddress(i, address), true, 'for same chain')
      t.equal(account.isChainAddress(i === 1 ? 0 : 1, address), false, 'for different chains')
    })
  })

  t.end()
})

test('nextChainAddress', function (t) {
  const account = blankAccount(f.neutered.json)

  // returns the new address
  f.addresses.forEach(function (addresses, i) {
    // skip the first address
    addresses.slice(1).forEach(function (address, j) {
      t.equal(account.getChainAddress(i), addresses[j], 'is moving forward the chain')
      t.equal(account.nextChainAddress(i), address, 'returns the next address: ' + address)
    })
  })

  t.end()
})

test('getChain', function (t) {
  const account = blankAccount(f.neutered.json)

  f.neutered.json.forEach(function (_, i) {
    t.equal(typeof account.getChain(i), 'object')
    t.equal(account.getChain(i), account.chains[i], 'matches internal .chain')
  })

  t.end()
})

test('getChains', function (t) {
  const account = blankAccount(f.neutered.json)

  t.plan(2)
  t.equal(account.getChains().length, f.neutered.json.length, 'returns the expected number of chains')
  t.equal(account.getChains(), account.chains, 'matches internal .chains')
})

test('derive', function (t) {
  const neutered = Account.fromJSON(f.neutered.json)

  t.test('neutered node', function (t) {
    f.addresses.forEach(function (addresses, i) {
      addresses.forEach(function (address, j) {
        const actual = neutered.derive(address)
        const expected = f.neutered.children[i][j]

        t.equal(expected, actual.toBase58(), 'return a neutered node')
      })
    })

    const unknown = neutered.derive('mpFZW4A9QtRuSpuh9SmeW7RSzFE3XL3FQp')
    t.equal(undefined, unknown, 'ignores unknown addresses')
    t.end()
  })

  const priv = Account.fromJSON(f.private.json)

  t.test('neutered node w/ escalation', function (t) {
    const privParents = priv.chains.map(function (x) { return x.__parent })

    f.addresses.forEach(function (addresses, i) {
      addresses.forEach(function (address, j) {
        const actual = neutered.derive(address, privParents)
        const expected = f.private.children[i][j]

        t.equal(expected, actual.toBase58(), 'returns a private node')
      })
    })

    const unknown = neutered.derive('mpFZW4A9QtRuSpuh9SmeW7RSzFE3XL3FQp')
    t.equal(undefined, unknown, 'ignores unknown addresses')
    t.end()
  })

  t.test('private node', function (t) {
    f.addresses.forEach(function (addresses, i) {
      addresses.forEach(function (address, j) {
        const actual = priv.derive(address)
        const expected = f.private.children[i][j]

        t.equal(expected, actual.toBase58(), 'returns a private node')
      })
    })

    const unknown = neutered.derive('mpFZW4A9QtRuSpuh9SmeW7RSzFE3XL3FQp')
    t.equal(undefined, unknown, 'ignores unknown addresses')
    t.end()
  })

  t.end()
})

// TODO
test('discoverChain', function (t) {
  // .getChainAddress() should remain the same after a uneventful discovery
  // .getChainAddress() should change after an eventful discovery
  t.end()
})

test('toJSON', function (t) {
  const neutered = Account.fromJSON(f.neutered.json)
  const priv = Account.fromJSON(f.private.json)

  t.plan(2)
  t.same(neutered.toJSON(), f.neutered.json, 'neutered json matches fixtures')
  t.same(priv.toJSON(), f.private.json, 'priv json matches fixtures')
})
