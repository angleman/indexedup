/* Copyright (c) 2012 Rod Vagg <@rvagg> */

var assert  = buster.assert
  , levelup = require('../../src/indexedup')
  , async   = require('async')
  , errors  = require('../../src/errors')
  , common  = require('./common')

var common = {
  nextLocation: function(){
    return 'testlu' + Date.now()
  }
}

var openTestDatabase = function () {
  var options = typeof arguments[0] == 'object' ? arguments[0] : { createIfMissing: true, errorIfExists: true }
    , callback = typeof arguments[0] == 'function' ? arguments[0] : arguments[1]
    , location = typeof arguments[0] == 'string' ? arguments[0] : common.nextLocation()
    levelup(location, options, function (err, db) {
      refute(err)
      if (!err) {
        callback(db)
      }
    }.bind(this))
}

buster.assertions.add('isInstanceOf', {
    assert: function (actual, expected) {
        return actual instanceof expected
    }
  , refute: function (actual, expected) {
        return !(actual instanceof expected)
    }
  , assertMessage: '${0} expected to be instance of ${1}'
  , refuteMessage: '${0} expected not to be instance of ${1}'
})

buster.testCase('Basic API', {

    'levelup()': function () {
      assert.isFunction(levelup)
      assert.equals(levelup.length, 3) // location, options & callback arguments
      assert.exception(levelup, 'InitializationError') // no location
    }

  , 'default options': function (done) {
      var location = common.nextLocation()
      levelup(location, { createIfMissing: true, errorIfExists: true }, function (err, db) {
        refute(err)
        assert.isTrue(db.isOpen())
        db.close(function (err) {
          refute(err)

          assert.isFalse(db.isOpen())

          levelup(location, function (err, db) { // no options object
            refute(err)
            assert.isObject(db)
            assert.isFalse(db._options.createIfMissing)
            assert.isFalse(db._options.errorIfExists)
            assert.equals(db._location, location)

            /*
            // read-only properties
            db.location = 'foo'
            assert.equals(db.location, location)
            */
            done()
          }.bind(this))
        }.bind(this))
      }.bind(this))
    }

  , 'basic options': function (done) {
      var location = common.nextLocation()
      levelup(location, { createIfMissing: true, errorIfExists: true }, function (err, db) {
        refute(err)
        assert.isObject(db)
        assert.isTrue(db._options.createIfMissing)
        assert.isTrue(db._options.errorIfExists)
        assert.equals(db._location, location)

        /*
        // read-only properties
        db._location = 'bar'
        assert.equals(db._location, location)
        */
        done()
      }.bind(this))
    }

  , 'open() with !createIfMissing expects error': function (done) {
      levelup( common.nextLocation(), function (err, db) {
        assert(err)
        refute(db)
        assert.isInstanceOf(err, Error)
        assert.isInstanceOf(err, errors.LevelUPError)
        assert.isInstanceOf(err, errors.OpenError)
        done()
      }.bind(this))
    }

  , 'open() with createIfMissing expects directory to be created': function (done) {
      levelup( common.nextLocation(), { createIfMissing: true }, function (err, db) {
        refute(err)
        assert.isTrue(db.isOpen())
        /*fs.stat(this.cleanupDirs[0], function (err, stat) {
          refute(err)
          assert(stat.isDirectory())
          done()
        })*/
        done()
      }.bind(this))
    }

  , 'open() with errorIfExists expects error if exists': function (done) {
      levelup( common.nextLocation(), { createIfMissing: true }, function (err, db) {
        refute(err) // sanity
        levelup(this.cleanupDirs[0], { errorIfExists   : true }, function (err) {
          assert(err)
          assert.isInstanceOf(err, Error)
          assert.isInstanceOf(err, errors.LevelUPError)
          assert.isInstanceOf(err, errors.OpenError)
          done()
        })
      }.bind(this))
    }

  , 'open() with !errorIfExists does not expect error if exists': function (done) {
      levelup(common.nextLocation(), { createIfMissing: true }, function (err, db) {
        refute(err) // sanity
        assert.isTrue(db.isOpen())

        db.close(function () {
          assert.isFalse(db.isOpen())

          levelup(this.cleanupDirs[0], { errorIfExists   : false }, function (err, db) {
            refute(err)
            assert.isTrue(db.isOpen())
            done()
          }.bind(this))
        }.bind(this))
      }.bind(this))
    }

  , 'Simple operations': {
        'get() on non-open database causes error': function (done) {
          levelup(common.nextLocation(), { createIfMissing: true }, function (err, db) {
            refute(err) // sanity
            assert.isTrue(db.isOpen())

            db.close(function () {
              db.get('undefkey', function (err, value) {
                refute(value)
                assert.isInstanceOf(err, Error)
                //assert.isInstanceOf(err, errors.LevelUPError)
                //assert.isInstanceOf(err, errors.ReadError)
                assert.match(err, /not .*open/)
                done()
              })
            })
          }.bind(this))
        }

      , 'put() on non-open database causes error': function (done) {
          levelup(common.nextLocation(), { createIfMissing: true }, function (err, db) {
            refute(err) // sanity
            assert.isTrue(db.isOpen())

            db.close(function () {
              db.put('somekey', 'somevalue', function (err) {
                assert.isInstanceOf(err, Error)
                //assert.isInstanceOf(err, errors.LevelUPError)
                //assert.isInstanceOf(err, errors.WriteError)
                assert.match(err, /not .*open/)
                done()
              })
            })
          }.bind(this))
        }

      , 'get() on empty database causes error': function (done) {
          openTestDatabase(function (db) {
            db.get('undefkey', function (err, value) {
              refute(value)
              assert.isInstanceOf(err, Error)
              //assert.isInstanceOf(err, errors.LevelUPError)
              //assert.isInstanceOf(err, errors.NotFoundError)
              assert.match(err, '[undefkey]')
              done()
            })
          })
        }

      , 'put() and get() simple string key/value pairs': function (done) {
          openTestDatabase(function (db) {
            db.put('some key', 'some value stored in the database', function (err) {
              refute(err)
              db.get('some key', function (err, value) {
                refute(err)
                assert.equals(value, 'some value stored in the database')
                done()
              })
            })
          })
        }

      , 'del() on non-open database causes error': function (done) {
          levelup( common.nextLocation(), { createIfMissing: true }, function (err, db) {
            refute(err) // sanity
            assert.isTrue(db.isOpen())

            db.close(function () {
              db.del('undefkey', function (err) {
                assert.isInstanceOf(err, Error)
                //assert.isInstanceOf(err, errors.LevelUPError)
                //assert.isInstanceOf(err, errors.WriteError)
                assert.match(err, /not .*open/)
                done()
              })
            })
          }.bind(this))
        }

      , 'del() on empty database doesn\'t cause error': function (done) {
          openTestDatabase(function (db) {
            db.del('undefkey', function (err) {
              refute(err)
              done()
            })
          })
        }

      , 'del() works on real entries': function (done) {
          openTestDatabase(function (db) {
            async.series(
                [
                    function (callback) {
                      async.forEach(
                          ['foo', 'bar', 'baz']
                        , function (key, callback) {
                            db.put(key, 1 + Math.random(), callback)
                          }
                        , callback
                      )
                    }
                  , function (callback) {
                      db.del('bar', callback)
                    }
                  , function (callback) {
                      async.forEach(
                          ['foo', 'bar', 'baz']
                        , function (key, callback) {
                            db.get(key, function (err, value) {
                              // we should get foo & baz but not bar
                              if (key == 'bar') {
                                assert(err)
                                refute(value)
                              } else {
                                refute(err)
                                assert(value)
                              }
                              callback()
                            })
                          }
                        , callback
                      )
                    }
                ]
              , done
            )
          })
        }
    }

  , 'batch()': {
        'batch() with multiple puts': function (done) {
          openTestDatabase(function (db) {
            db.batch(
                [
                    { type: 'put', key: 'foo', value: 'afoovalue' }
                  , { type: 'put', key: 'bar', value: 'abarvalue' }
                  , { type: 'put', key: 'baz', value: 'abazvalue' }
                ]
              , function (err) {
                  refute(err)
                  async.forEach(
                      ['foo', 'bar', 'baz']
                    , function (key, callback) {
                        db.get(key, function (err, value) {
                          refute(err)
                          assert.equals(value, 'a' + key + 'value')
                          callback()
                        })
                      }
                    , done
                  )
                }
            )
          })
        }

      , 'batch() with multiple puts and deletes': function (done) {
          openTestDatabase(function (db) {
            async.series(
                [
                    function (callback) {
                      db.batch(
                          [
                              { type: 'put', key: '1', value: 'one' }
                            , { type: 'put', key: '2', value: 'two' }
                            , { type: 'put', key: '3', value: 'three' }
                          ]
                        , callback
                      )
                    }
                  , function (callback) {
                      db.batch(
                          [
                              { type: 'put', key: 'foo', value: 'afoovalue' }
                            , { type: 'del', key: '1' }
                            , { type: 'put', key: 'bar', value: 'abarvalue' }
                            , { type: 'del', key: 'foo' }
                            , { type: 'put', key: 'baz', value: 'abazvalue' }
                          ]
                        , callback
                      )
                    }
                  , function (callback) {
                      // these should exist
                      async.forEach(
                          ['2', '3', 'bar', 'baz']
                        , function (key, callback) {
                            db.get(key, function (err, value) {
                              refute(err)
                              refute.isNull(value)
                              callback()
                            })
                          }
                        , callback
                      )
                    }
                  , function (callback) {
                      // these shouldn't exist
                      async.forEach(
                          ['1', 'foo']
                        , function (key, callback) {
                            db.get(key, function (err, value) {
                              assert(err)
                              assert.isInstanceOf(err, errors.NotFoundError)
                              refute(value)
                              callback()
                            })
                          }
                        , callback
                      )
                    }
                ]
              , done
            )
          })
        }

      , 'batch() with can manipulate data from put()': function (done) {
          // checks encoding and whatnot
          openTestDatabase(function (db) {
            async.series(
                [
                    db.put.bind(db, '1', 'one')
                  , db.put.bind(db, '2', 'two')
                  , db.put.bind(db, '3', 'three')
                  , function (callback) {
                      db.batch(
                          [
                              { type: 'put', key: 'foo', value: 'afoovalue' }
                            , { type: 'del', key: '1' }
                            , { type: 'put', key: 'bar', value: 'abarvalue' }
                            , { type: 'del', key: 'foo' }
                            , { type: 'put', key: 'baz', value: 'abazvalue' }
                          ]
                        , callback
                      )
                    }
                  , function (callback) {
                      // these should exist
                      async.forEach(
                          ['2', '3', 'bar', 'baz']
                        , function (key, callback) {
                            db.get(key, function (err, value) {
                              refute(err)
                              refute.isNull(value)
                              callback()
                            })
                          }
                        , callback
                      )
                    }
                  , function (callback) {
                      // these shouldn't exist
                      async.forEach(
                          ['1', 'foo']
                        , function (key, callback) {
                            db.get(key, function (err, value) {
                              assert(err)
                              assert.isInstanceOf(err, errors.NotFoundError)
                              refute(value)
                              callback()
                            })
                          }
                        , callback
                      )
                    }
                ]
              , done
            )
          })
        }

      , 'batch() data can be read with get() and del()': function (done) {
          openTestDatabase(function (db) {
            async.series(
                [
                    function (callback) {
                      db.batch(
                          [
                              { type: 'put', key: '1', value: 'one' }
                            , { type: 'put', key: '2', value: 'two' }
                            , { type: 'put', key: '3', value: 'three' }
                          ]
                        , callback
                      )
                    }
                  , db.del.bind(db, '1', 'one')
                  , function (callback) {
                      // these should exist
                      async.forEach(
                          ['2', '3']
                        , function (key, callback) {
                            db.get(key, function (err, value) {
                              refute(err)
                              refute.isNull(value)
                              callback()
                            })
                          }
                        , callback
                      )
                    }
                  , function (callback) {
                      // this shouldn't exist
                      db.get('1', function (err, value) {
                        assert(err)
                        assert.isInstanceOf(err, errors.NotFoundError)
                        refute(value)
                        callback()
                      })
                    }
                ]
              , done
            )
          })
        }
    }

  , 'null and undefined': {
        'setUp': function (done) {
          levelup( common.nextLocation(), { createIfMissing: true }, function (err, db) {
            refute(err) // sanity
            assert.isTrue(db.isOpen())
            this.db = db
            done()
          }.bind(this))
        }

      , 'get() with null key causes error': function (done) {
          this.db.get(null, function (err, value) {
            refute(value)
            assert.isInstanceOf(err, Error)
            //assert.isInstanceOf(err, errors.LevelUPError)
            done()
          })
        }

      , 'get() with undefined key causes error': function (done) {
          this.db.get(undefined, function (err, value) {
            refute(value)
            console.log(err)
            assert.isInstanceOf(err, Error)
            //assert.isInstanceOf(err, errors.LevelUPError)
            done()
          })
        }

      , 'del() with null key causes error': function (done) {
          this.db.del(null, function (err, value) {
            refute(value)
            assert.isInstanceOf(err, Error)
            //assert.isInstanceOf(err, errors.LevelUPError)
            done()
          })
        }

      , 'del() with undefined key causes error': function (done) {
          this.db.del(undefined, function (err, value) {
            refute(value)
            assert.isInstanceOf(err, Error)
            //assert.isInstanceOf(err, errors.LevelUPError)
            done()
          })
        }

      , 'put() with null key causes error': function (done) {
          this.db.put(null, 'foo', function (err, value) {
            refute(value)
            assert.isInstanceOf(err, Error)
            //assert.isInstanceOf(err, errors.LevelUPError)
            done()
          })
        }

      , 'put() with undefined key causes error': function (done) {
          this.db.put(undefined, 'foo', function (err, value) {
            refute(value)
            assert.isInstanceOf(err, Error)
            //assert.isInstanceOf(err, errors.LevelUPError)
            done()
          })
        }

      , 'put() with null value causes error': function (done) {
          this.db.put('foo', null, function (err, value) {
            refute(value)
            assert.isInstanceOf(err, Error)
            //assert.isInstanceOf(err, errors.LevelUPError)
            done()
          })
        }

      , 'put() with undefined value causes error': function (done) {
          this.db.put('foo', undefined, function (err, value) {
            refute(value)
            assert.isInstanceOf(err, Error)
            //assert.isInstanceOf(err, errors.LevelUPError)
            done()
          })
        }
    }
})