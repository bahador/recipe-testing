var fs = require('fs');
var _ = require('underscore');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/drive-nodejs-quickstart.json
var SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://mail.google.com',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send'
];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'drive-nodejs-quickstart.json';

var emails = {};
var recipes = {};
fs.readFile('emails.tsv', 'utf8', function (err, content) {
  if (err) {
    console.log('Error loading emails file: ' + err);
    return;
  }
  var lines = content.split('\n');
  lines.shift();
  var data = {};
  _.each(lines, function(line) {
    var elements = line.split('\t');
    emails[elements[2].trim()] = {
      name: elements[1].trim(),
      email: elements[2].trim(),
      diet: _.reduce(elements[3].trim().split(','), function(memo, val) {
        var v = val.trim();
        switch (v) {
          case 'Omnivore':
            memo.omnivore = true;
            break;
          case 'Pescatarian':
            memo.pescatarian = true;
            break;
          // case 'No Sugar':
          //   memo.noSugar = true;
          //   break;
          case 'No Wheat':
            memo.noWheat = true;
            break;
          case 'Vegetarian':
            memo.vegetarian = true;
            break;
          case 'No Dairy':
            memo.noDairy = true;
            break;
          case 'Vegan':
            memo.vegan = true;
            break;
        }
        return memo;
      }, {
        omnivore: false,
        pescatarian: false,
        // noSugar: false,
        noWheat: false,
        vegetarian: false,
        noDairy: false,
        vegan: false
      }),
      numberOfRecipes: (function() {
        var num;
        switch (elements[4].trim()) {
          case 'Two':
            num = 2;
            break;
          case 'Three':
            num = 3;
            break;
          case 'Four':
            num = 4;
            break;
          default:
            num = 5;
            break;
        }
        return num;
      })(),
      notes: elements[5].trim(),
      recipes: []
    };
  });
  fs.readFile('recipes.tsv', 'utf8', function (err, content) {
    if (err) {
      console.log('Error loading recipes file: ' + err);
      return;
    }
    var lines = content.split('\n');
    lines.shift();
    var data = {};
    _.each(lines, function(line) {
      var elements = line.split('\t');
      recipes[elements[3].trim()] = {
        formName: elements[0].trim(),
        formId: elements[1].trim(),
        docName: elements[2].trim(),
        docId: elements[3].trim(),
        omnivore: !!elements[4].trim(),
        vegetarian: !!elements[5].trim(),
        vegan: !!elements[6].trim(),
        pescatarian: !!elements[7].trim(),
        noDairy: !!elements[8].trim(),
        noWheat: !!elements[9].trim()
      };
    });

    var compatibleRecipe = function(recipe, diet) {
      if (diet.omnivore) {
        return true;
      }
      _.each(diet, function(value, key, object) {
        if (recipe[key] !== value) {
          return false;
        }
      });
      return true;
    };

    var counter = 0;
    var recipeKeys = _.shuffle(_.keys(recipes));
    var recipeCounter = {};
    var getRecipe = function(diet) {
      var val = counter++ % recipeKeys.length;
      var key = recipeKeys[val];
      var recipe = recipes[key];
      if (compatibleRecipe(recipe, diet)) {
        if (_.has(recipeCounter, key)) {
          recipeCounter[key]++;
        } else {
          recipeCounter[key] = 1;
        }
        return recipe;
      } else {
        getRecipe(diet);
      }
    };

    _.each(emails, function(email) {
      var line = email.name + '\t' + email.email + '\t';
      var d = [];
      _.each(email.diet, function(v, k) {
        if (v) {
          d.push(k)
        }
      });
      line += d.join(', ') + '\t' + email.numberOfRecipes + '\t' + email.notes + '\t';
      _.each(_.range(email.numberOfRecipes), function() {
        var recipe = getRecipe(email.diet);
        email.recipes.push(recipe);
        line += recipe.docName.split('.docx')[0] + '\t' + recipe.docId + '\t';
      });
      console.log(line.trim());
    });
  });
});

// Load client secrets from a local file.
fs.readFile('client_id.json', function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }
  // Authorize a client with the loaded credentials, then call the
  // Drive API.
  // authorize(JSON.parse(content), listFiles);
  // authorize(JSON.parse(content), sendEmail);
  // authorize(JSON.parse(content), generateLinksForFiles);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  var clientSecret = credentials.web.client_secret;
  var clientId = credentials.web.client_id;
  var redirectUrl = credentials.web.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
  google.options({ auth: oauth2Client }); // set auth as a global default

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the names and IDs of up to 10 files.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */

// var pairs = [['1B39aQyEcDzooBk-bnnWxNfqXj8iAGUwXbfWXo4FZvvA', '0B7FMWP-mb_mleVlUc0puSUF0Yjg'], ['1u6wMVr5i4Yd867FQcwfsJZPm-dz8pDOMnDIf7j9X-mw', '0B7FMWP-mb_mlQjdBVWdlQllseW8'], ['1GOScCXlYmIxDTSYyh1PPqKOzJ7haA34oPqegGp6d57s', '0B7FMWP-mb_mlZDVOSlBPd2NwM2c'], ['1vjCXNkUauRE2SO-cAWc54rP2JBFCI2bksN-O2bkn6To', '0B7FMWP-mb_mlbXZGYWpNTVJ6NUU'], ['1IoIrN_RhGAHpdRRmLkBMXuC5Hm3FKbnpsZDkuTRJTnU', '0B7FMWP-mb_mlWktPQXN4RVNUOTA'], ['1z6oxzBArj5JgH1CkvX09ZFskBvWrqNk-59o-UdBUpx0', '0B7FMWP-mb_mlNkpxYmFCdi1vMWM'], ['1kqGWPBWqfC7EPBJ-FMJVVmq4XaofRvOXijJjyHD3LYs', '0B7FMWP-mb_mldE5fMG8tU3ZVSEU'], ['1H94iZWDekqbi4ME2Rk4Zx79iMrbxGjS4MRBQ7m_kHYI', '0B7FMWP-mb_mlTmFrS1VEYVdsaDA'], ['16bLjzUYtSAPjAOsudtQ3I0oPzyk5btSbQkreAn4Xc3o', '0B7FMWP-mb_mlVWFIc1pnNENFOHc'], ['1PpaZq6MmYn9573bqZpy4r4HL90uPFoyIJo0k_JsdFBo', '0B7FMWP-mb_mlczJmR0lkNmVveFE'], ['1nzj5dgI2Bg4tZatAVRFQFy7gtsDhLKxSeisFZhS2eSE', '0B7FMWP-mb_mlcGU3QjZhZENKNWc'], ['14AKjjjc65EOczj2yUIJi074HRiSb4P5wA3bFEDMSgOc', '0B7FMWP-mb_mlaXhDV3BaNTBsanM'], ['1ewgElCO7SQAnkEL-W1laLcOGn5246r-MWdGUH620w9s', '0B7FMWP-mb_mlaVU0cEFfVEh1ZVU'], ['1ZcI3gH8NNlNRq7uxYVCfixstzOBfvGXPwHc3OVbSuss', '0B7FMWP-mb_mlYV9lQTNrelpMR28'], ['1heS1LD1MrdYgmh8jf2n5sbmA5dDFB7sPXovhbFn6Qso', '0B7FMWP-mb_mlUXEzSUFFaDdwRGs'], ['1wLUzr-Eoj_w8SXjVzidjpUU_F-WvvXQwU1b7g5Ze8m0', '0B7FMWP-mb_mlcTBoZ2h0eEtMNmM'], ['1CVgRxCLhBvt5hSBWFbyJ0wSg3y7w_WY-SpIS2qEvv-o', '0B7FMWP-mb_mlMTZ4ai1IblBDQWs'], ['1IHHzkkgqz3GNiOQOBTTDNnXWK_15CqHKMQB94BFIZNs', '0B7FMWP-mb_mlQ3h3VFZibGdfS2M'], ['1Ll05CKDWIheF7pIYSgK8hw7Xr5il3jItkxhAUD9ebtc', '0B7FMWP-mb_mlbDU0eExoaC1wdFE'], ['11phapA6mspBbsU4Fl3stNQ_AsgJpquO-UcrttfAwhLo', '0B7FMWP-mb_mlSGxFQVRQelcwS3c'], ['1AJopYoWO3oN5lh-MDdOA8fnB8OEMsTb7d-pg-i7rJZw', '0B7FMWP-mb_mlZ2JrTGVRSUFGVkk'], ['1p6CTV5g7Wzawtl83HdpwbTikOtd4pkVkuH45IkcDVvc', '0B7FMWP-mb_mlWGdwdFdUS0MyTkU'], ['1RygvQJ2ew8e0Oc8uBJyAQaz5wQzxGUqEe_PCtokQ0q8', '0B7FMWP-mb_mlenljT1pVNDdXcFU'], ['181jSV5yukCXswiC12xwFYxSaWemqke5GGPeoMID4yQY', '0B7FMWP-mb_mlakluZ1diN1dlQlk'], ['1jK8VcdeLnq-ZuB0uneN4yiYTdgnISkkHCigUCB_3qPs', '0B7FMWP-mb_mlcDJTdWVTYUhfc1E'], ['1SgftKR0As7iAgQH1BNJ_vI4dkF2TM8_aIWNVg1WR3us', '0B7FMWP-mb_mlOXZ0Q2RLOVdtY0U'], ['1KK8mAFeB4OVRzb8iDhkqbqv6wqlK7qZvdCwmKROYRtg', '0B7FMWP-mb_mlaElHcThIWWIwZ3c'], ['1rdzUrHJpoYp5leJH7YXSGCZAUovTsF9CqfEe1pEkdA8', '0B7FMWP-mb_mlSDJmdDVsZnVQMVU'], ['1t_u31yNCg45KdEn75nSm5or0SlgXNC5FQKZxjphSxAU', '0B7FMWP-mb_mlVHQ2NmN6RzFrVTQ'], ['1-jyMudxM2WzkD0c4Z2qX0SeL0P3hq1Q67pq2tMMKpAU', '0B7FMWP-mb_mlREF4cDB0RmltS3M'], ['1TdZNR-Qx-ZXsvjUjH-aWg4oHHp0ka0J6r6EMqZLRN1w', '0B7FMWP-mb_mlZE8tYi1QM2FPUzQ'], ['1l24ClzMXsyd_UNHITBWTFOgf3mixiXLA3Hkg11qZnD0', '0B7FMWP-mb_mlZlo2b0c5UU9DMm8'], ['1Vj3j1WSfq9sqg_psu1k96fRZpx0rbjHgxsAnIpZF3bE', '0B7FMWP-mb_mlR0NDOHlhWkRGZDQ'], ['1CO_oa-JWWmceNzDqRZXIbrJtJPsdrULYZuRS61U7UsU', '0B7FMWP-mb_mleVpVamFnV0dOS0U'], ['1mhiFLFCPChchWIr_WWkO0Gb7bv6xIESV0760mWZ1fvU', '0B7FMWP-mb_mlcnVXYWlzaUNjSk0'], ['1miCMEiQ6R4o5-6j3B3gFpdLIy8UJMBfjRDXOqsdr-x0', '0B7FMWP-mb_mlSmF1R3FvNjNGZnc'], ['1SGo4O1f3gsckxFcia3Nl9tliGKkqaSRu9STVF5o3RuI', '0B7FMWP-mb_mlLS1adnRKaHFrdzA'], ['1vv-SRXTXISoebka1YH0elNdd2IaBW8qJNvraXPebX8A', '0B7FMWP-mb_mlaGNublpuNFk1Q00'], ['1fogUC_9FQgnQNJ5eRHMC7MDP2yrVvU7xqxiC92TRtN0', '0B7FMWP-mb_mlU0R0UUtnNF9BbW8'], ['1UZaLQH9OC1adZxemNysfZEJsbsnFwQpwaSf8Ht-waSk', '0B7FMWP-mb_mlajM2ZG1WdHB0Ym8'], ['19Ef3hQJTpSu-R6Tot0Yy5Fg8_ueRU48dgvoasuf6u90', '0B7FMWP-mb_mlOFAwM2oySE1NS0k'], ['1GJ8zA_mRJKD6t7u1qQ8kUTIg6TU3RL9wB9SYEsMauSo', '0B7FMWP-mb_mlSUZHR1ZwQjhCeGc'], ['1KS_7jqaEHAHaDfnpHwUigkpLMx6xQXv3Jp2TwUMrNpo', '0B7FMWP-mb_mlQWs1dWc2amtNRlk'], ['1vNPUPbiBVaiedu5Ge57KCz25S2JSW7JmKUqr4zIY1Hs', '0B7FMWP-mb_mlVmpaSkNrWkJXLW8'], ['1Ileu6kpFSKwe7UnqlG3CLsR9X5ukRxPjE-Iva2x9W7E', '0B7FMWP-mb_mlUGRtNEYybnJkS1k'], ['1hTr6YYSvS582GRJgUH4FOZbMYEEyeA-TB5YbX-MhlGU', '0B7FMWP-mb_mlUVAyb1hCZFF2RDA'], ['1HrYs9pSGDH5KByKly6dxrPAOF6hgaS7dIOi1DLpDqkY', '0B7FMWP-mb_mlMmFRQTJsaFp5eEU'], ['1C0W4etPSrmRzrHlpskvAd8PPUTCO7QajkhxrhPvqlAk', '0B7FMWP-mb_mlZEdpT2dSV1JqM28'], ['1FqHJfetkw79-WHCCDERjdarxm-LnUzCOKSvBbQXfjOI', '0B7FMWP-mb_mlRWNyb1h1MlB6dWs'], ['1tOLgI4bQE2oQsVA7ijLmfCXuyD6ss8T7vQN5SDS7UgM', '0B7FMWP-mb_mlTktLSXQ0cWdxZ0k'], ['1G_tfpVo71ud28BVFn6ndj2bHsfykmQH5Kv_FCJoSF1M', '0B7FMWP-mb_mlQlo3RDN1U1dzcjQ'], ['1z_eiWzjTtXz_RFQMsl8RM1RXFRmBYhxfhP75Urmut-k', '0B7FMWP-mb_mlUlNsM3p6OGR0dWM'], ['1THm6REhjQBq0b3iHUdtxKAY0bZe4vWBZCKIDELk1vMw', '0B7FMWP-mb_mlT2w2ZHllSFlqNTA'], ['1ZvAqcedwzLIbhsCaTFBP7QQrW-D7x9Fx3yPodd0X29g', '0B7FMWP-mb_mlbDVHb013UWxOaEE'], ['1aA4D3YErHfJyNbKB61IUfwrh4LX7PyTopG-hnFpoRUw', '0B7FMWP-mb_mlcndlYmxIM3pKVTA'], ['15dUHHd7HIkKyZ7DLNxeQ3QKua8S96xLhm8WruGuWyPM', '0B7FMWP-mb_mlSXRGMG8xcDRWaDQ'], ['1LOet_KOIzH86etilFiB7_UwPgu-zibBtQqP3mpjnzZM', '0B7FMWP-mb_mlSGR3WTBqXzZLaVE'], ['1l1qsiu15-B6Zr3xtqraDd1oIHsWoPgAmqI8e20d81Bo', '0B7FMWP-mb_mlS2JQWWhVbUtQbm8'], ['1S9pqEIj4QCNCWqs87nCrZZ2WZqcc2QPyUvOEtWNcUXs', '0B7FMWP-mb_mlM3JybmhSaUM5TE0'], ['1rFhMoczjqlfvjoJfiuf2zyKVrovPR-TfMFr2M7uoBRc', '0B7FMWP-mb_mlMmxZX2RrR1hDX1E'], ['1iowENIKe-f6uTCxOr8Q6sQdrxZgno3bs3FAe-xkwdx8', '0B7FMWP-mb_mlclpuU0hJa0JBMjA'], ['1gHaSixnN-zguqhQkuQlPegDE6_wk3c9csZ4K0tOgYRc', '0B7FMWP-mb_mlbGRvbU5WLWZBb3c'], ['1YrxNvM1529scCN0NZlsJyFU-B_DO2UxgMhlqpw1H6do', '0B7FMWP-mb_mlR2F1cWZKVng0MUk'], ['1EMFlyC418HEbI6r_LpGIsfG9-e0sbrexrVNozqeNu8g', '0B7FMWP-mb_mlU0N6ajFYVElCNUU'], ['1YuIowhOg7WZEw9p3B9pybs2QJlm3xAY5FLZXt-I4gdM', '0B7FMWP-mb_mlVnplMGkta2ZSelU'], ['1TiWCmAk8pFnB7IopaSER58IaZKD6cArkYd-fBFN8kgI', '0B7FMWP-mb_mldFlMc2xPM3dmZFk'], ['1SMxv6DOXTRMytwr7DauVGKkqmYtS2WulDxMvGZvKfg0', '0B7FMWP-mb_mlZUZiR1hMOHFzVEE'], ['1tgSVvUcMHJHVELjZzNGlml207quloBadOsNyW-lNPl0', '0B7FMWP-mb_mlWmtDQi00cy1BbVE'], ['1fhI00ziJr4MWgzrgDplkD39vqOfAY9jDPWko03YsVT0', '0B7FMWP-mb_mlNklJWUxWZE9SeDA'], ['1I7MDWdAsBm9HIL2P2azsUGC7Uq8RQYc_KCisnM9isSI', '0B7FMWP-mb_mlSGdrczN6STlyLTA'], ['1vaKdPbioa_4p_20xaA1V3MWPWNat-j_uSBqSsW7TdtA', '0B7FMWP-mb_mlSHJHZ1c4NGgybG8'], ['1HvqjxZs34c8UIUHBPLvdm7MhB7aUZve8Sc1D1IOFb9A', '0B7FMWP-mb_mleTlqTXkzYktOMFE'], ['1t6NjdiPEmq0PoDCwyZ9TIsVHefL8g9DMC1yTlLTX7ZA', '0B7FMWP-mb_mlX1V5WThDOXN4dkE'], ['1RYgOT-WPeArR85Mc1aqzWk0RAEibtcU7Aj4ig_Au5lg', '0B7FMWP-mb_mlZGNGYy1VajR4N1E'], ['1e2xnx78lFEOM4kUyWa1FvNLeQR-nyUJggFGrBZPZ-1o', '0B7FMWP-mb_mlcGQ5NVAxaGlBN28'], ['17Ph4mMrqgCKrDzi-FzGdUhWrxUnrV5lAJq4qH0Udueg', '0B7FMWP-mb_mlWDcxdlE5NUE5dlE'], ['19qzbKO5z1oxIRgVjmIXwS0jZZ0R7pLbpqTgIVcE9WvA', '0B7FMWP-mb_mlU1YxOFhpM2p4MG8'], ['1wKUIP1C6EDEQ9qzhqnk2Jcy-hNyitCcSXE5uPIm0r4s', '0B7FMWP-mb_mlN3BNdHdaVGV2bk0'], ['1BhKIfxK8IPYPfyVsh30s9mzP4J5A25vzVu5jBL0V5QM', '0B7FMWP-mb_mlUE1NV3R3TGd0dVU'], ['1QUUYAqBVPW0cgT-edQM_kpMJPape89GT3xmetKDQHN8', '0B7FMWP-mb_mlam9tQUc0MDVka1U'], ['12abo_baUt145waDoT7taSJCEHyylREHlgQyPcNL_Vuc', '0B7FMWP-mb_mlQ3dLcHlzU25lRDg'], ['1blfTnQkSavkWROv2UFBn5ri0C7W7cQeeg7ex6ZTuMW4', '0B7FMWP-mb_mlbk9pUHMtRmtVN1E'], ['1SAjcKungF-rTB78H1WBNQz4kJAIlhy1jl6AdgjBjVPg', '0B7FMWP-mb_mldFlMc2xPM3dmZFk'], ['1_cmeL6xPC1p27UqRH57NsMpGfCgtnPMyjnsuUm_gibQ', '0B7FMWP-mb_mlS3dKdTktejh2TU0'], ['1XChsCEvCBO-oS6GfQ0KQJdAq0fPE3GrtAir0-I4kDLY', '0B7FMWP-mb_mlZldfMjh6NGJBekE'], ['1de5UepT6ZJk2zOwlCikDa0otS4Nd9Ucb6AG_OUEAkKU', '0B7FMWP-mb_mlZ2JXa1B0OF9xT0E'], ['1UNIB7QMLji2SrAMb2JqzgcteQWdkWrtpSMBPgeri3bk', '0B7FMWP-mb_mlNXFJeGRaR3VpQ2s'], ['1RKyUFsNhGF9MQ5gP7aDNDuigtPUQ7H3K1Js3U70gIXA', '0B7FMWP-mb_mlVC12MFR1TjlKY1U'], ['1bYyRxaxMfkuL0aa6CYSEXh_fnvCk38n-f3uL_zdZl3g', '0B7FMWP-mb_mlaVgwN21LcFlsZGs'], ['1s96BkOuHtrhVi9KeEO1p0MdDKYi8g2R7YVCPxtMYGN8', '0B7FMWP-mb_mlTjZncmN5bjNNVXM'], ['1_HAilVk5OoQW3YBWvL4H9b9sbWw0KDi9P6Xm9DH4FSs', '0B7FMWP-mb_mlbXRucHpQQjZFaGM'], ['1L3JkmL6TgNyOOiKKlvgB8WYydm7siuwFYI5lIaNQcfo', '0B7FMWP-mb_mlMVg2OXp0Mk5PaGc'], ['1geQtSD5FHF1lBv7dqL2ndxGr1l0jJoFv4_plUp90iZE', '0B7FMWP-mb_mlTVhNdHZaOU8ta3M'], ['1xkbftnQLZd6nr1NanrGZU_SVpo41mtaShrCLmVmetGU', '0B7FMWP-mb_mlYXdNX20tc1c2Nms'], ['19MqAxagHU28Ra4gcCCTAMdjHpHNiYHYQYN07jt9G12E', '0B7FMWP-mb_mlaWQ5R1RLU1NBcFk'], ['1H8KfgFN-1EDwHupnjezPVPcxlQeim2r3ky30l5650tQ', '0B7FMWP-mb_mlUENtZVdhd3FFelU'], ['18OFg0XrifZgWgZ7YBDiLRxTClb-VIEYQ7SHqpWcqZZc', '0B7FMWP-mb_mlNXNTZWVNM1V2aTQ'], ['1flnB3xOD3rv49jIrFovQSIJyLBSn8LE0ImMCVeULTKg', '0B7FMWP-mb_mlMm5pbko3b0NpVnc'], ['1fnzyPN6gyrcvMhSd9o-kEhBOQP7wpkur6KcxTqhLM98', '0B7FMWP-mb_mlbWt1Q0gxcDJhbVU'], ['1sG0dRTzRrEc8orZdGyY6nocgANjHRpPgAKV43JKM_88', '0B7FMWP-mb_mlMkVaMm1QSHllOFE'], ['1j10e3yWESUNPxXXoT72oT_YNVfCNcj9pMlRn6TElc60', '0B7FMWP-mb_mlbGptSzk1eW5vNW8'], ['1dkgeTk-KAMHJNGbb0UHW65pNhK0gqpKL-zuWmw96nAg', '0B7FMWP-mb_mlOGtnM2trSnd6VGc'], ['1tGiEJmqWAMPejZRhFqzrK6FDFi8x4CJBNZP3uiAqX3c', '0B7FMWP-mb_mlRDc1VXhZY2ptWm8'], ['141w2tCOzdL-WvDX62IlIdxMqfEV2sBwUCKHAa28Y8Xk', '0B7FMWP-mb_mlamdIY0dMRkhXUlU'], ['1OG7iin2NfkVrmmYuIRuXvufT4WzCyL7kJSwStN-50aI', '0B7FMWP-mb_mlc3ZoZFpfUFhhUHM'], ['1UqNIztEQB9LsV0f19muFB1hBXoy4dPPD5g6FIEF68d0', '0B7FMWP-mb_mlM1dzWjhEN1dNZDg'], ['1M8llSiAic1WiSknEGtAD8-D13h32j8-AfGPCuMmwyp4', '0B7FMWP-mb_mlbkU4Q2lQRkxTZUk'], ['1gE-fphFummFMy89Fozq7XieoeOIiZah4mSkTTcg1gHw', '0B7FMWP-mb_mlbWhvZnZRU1hCc1U'], ['14BsU4XkPYTdUbTAq772oQv9FmPmvTU7AGxDrd2VI3AY', '0B7FMWP-mb_mlcThrOXJnVy15dWM'], ['1iabHmkcGzJpbCNfMD9KRSKIDZfevMMhjLX3RCOIHqrw', '0B7FMWP-mb_mlNzEwWHdVWjZuMVk'], ['1nsXCl8bobKHaZBtlQozpKBcreImqzhQaBgQp5GtIpcY', '0B7FMWP-mb_mlZmU5OWJUdE54LXc'], ['1003wT7bIXXYcUd18N-laZ246fK5ffYDuVpAn2ica5I4', '0B7FMWP-mb_mleEptSkJVVmdXaWM'], ['1qlIkbXktcqFUVxGNbstvgUGtM9pqsJ_xbCCXApZTZj0', '0B7FMWP-mb_mlR0FXcU9CeXhqLTQ'], ['1vyIBmJTzKLowDIp9PRMs8aGYfT-pJXCR6jMl57gT1Kc', '0B7FMWP-mb_mlUjNWVldUVkZjYmc'], ['1CkloKXm6qsofhBHQCA6gYERmwwy11AIFS5MhayvGgZo', '0B7FMWP-mb_mlY3IzNXpLQXgxMlE'], ['1XzCkB8BtNxJsYXUivT5J1QVy9mMkjqRRw91Cm59a-GI', '0B7FMWP-mb_mlZ3NrV2JJdFhma0k'], ['1vxJ8ILNkKREAdsKVgtXoR7O7M4t2ZcdHXRNVF3crQ5E', '0B7FMWP-mb_mlNEpORjJrVVpZb0k'], ['1tdVYjTqK6zKMlxiX0-pVxlCOwSzNZQUFmdCV_y7a2co', '0B7FMWP-mb_mldWRoRFBiX1haZ2c'], ['1ls5_v9R6vTZInGXsXkHF6lySsTSTSn9M-GO42kD_nMA', '0B7FMWP-mb_mldm5XUjNjWWIwYTQ'], ['1iGw-s7Eb4nD8hTAFEZe4N60g9epNZkh9PEsm0AuF29Y', '0B7FMWP-mb_mleG5CNHdTQ0ZjWW8'], ['1s3gIHnX75cAt6J-fw4yf-DO2AE6wtYHUdCbrqFIUx5E', '0B7FMWP-mb_mlal9acnNlZHF5azg'], ['1xKE3WMdW0algPaWnfHwdACrGoCJupc8AYPI_-jgKXDA', '0B7FMWP-mb_mlbnpoakhZS2QxSjA'], ['1x3KdToFEuB3GmH-0568B5T3Jpn9pYac4FmhnatrM9Sc', '0B7FMWP-mb_mlajlCYm41bE5FcWs'], ['1-2vwkl-3hnKVlZxS6MCkM5I0LLFj77NkOwe4_CG8i1A', '0B7FMWP-mb_mlbGc3UTdUeDlqNnM'], ['1fjnsQPjsEpcPQUBOEdcgFsEvyiANe1m2s_lH1jrZOzU', '0B7FMWP-mb_mlTHJnRWRtUEJOVk0'], ['1PG5dR1_hlkHPSlNCz7WIuCJjFH0NJRv_yBRb1uCbrKI', '0B7FMWP-mb_mlU3RGZjdEVTRWM2s'], ['1QBQRNrqi0VbA9Ri172ZwkSzbdtT5qtnfm9TRgz6qPBQ', '0B7FMWP-mb_mlRnVtSUpveFZveEE'], ['1xOTMC3NJWJ80jTmscWvMZWZbJJx7YsR94yCX8mbWF7k', '0B7FMWP-mb_mlLVY2TmlCOG1rWm8'], ['1LYSF-6_z_U1JXKoLrE9KD5jAtG9W3_HkVOrLKc5UF_0', '0B7FMWP-mb_mldXJQQWZ3ZjVuX0E'], ['1sSI9TSRNEIbxZdTyxp9kO0GWuYu7kbpc4Ucosk_BSkY', '0B7FMWP-mb_mlODFHZURlcVZWb28'], ['1MwVJdVF4MCP1q8-PhSTbwXrVn8yHkydy5XMyuxgwyMc', '0B7FMWP-mb_mlak5RZl80dVJlSk0'], ['1vCd601IgFbtwKcv4QkECKg1Asc2vcpY39ClsHFUdh4s', '0B7FMWP-mb_mlVHpoMzhmSEVObGM'], ['1wLY4rGzqr7uxb71-vwBtL5BswOKP0DsImvhRKy082Jg', '0B7FMWP-mb_mlcjl1MmZrd3lkYzQ'], ['1xJR9V5kCx2MioS1JQAJ325eNXu7Tldza6orchN9TsNc', '0B7FMWP-mb_mlWGVlWERnZEI3SWc'], ['1OfeLtYw9xr6OSs31_BHdBXO-ABF1x98C9pGw065teUg', '0B7FMWP-mb_mldFk4MjFiVldSUVU'], ['1edqcoLYVysFQIkK33MRfHY0YH579W7-asfLCJHMJZSo', '0B7FMWP-mb_mlekIzMmNBMDAwTWs'], ['1IS4gwUaOX7X3S_Q1_yAbpSuGXaN9-Jf0d826xaMAv0I', '0B7FMWP-mb_mlU21CaEJFelZib3M'], ['1j8ouaRFZrDJ_J1P0MWHTL4OlOTCQ1fQHzfl9Y9b1xjY', '0B7FMWP-mb_mlRlo2ODA0elZfSHc'], ['1C64VJhQFnhgMAxEV2yUJHOd88nHOQUK-G5Hb7_smdGQ', '0B7FMWP-mb_mlNU5ZcXhpWTQ1aVE'], ['1QdV8eLRs8HtkaEgzGDl3Rj01goTUbK-idsAM8IC1dRo', '0B7FMWP-mb_mlUXdWXy1ZbG5xNVE'], ['13Dy5mqSAXry-QSYuunrfZvlnIOKmxWEDccWO1Z4xhvw', '0B7FMWP-mb_mlQVU5NmdaX0hrWDg'], ['1TMuLw85oG7f6m4iuZNOijrQkqQdznD8pkngqwUK65fg', '0B7FMWP-mb_mlWjB2VFVzVUlaVFk'], ['1DKmIsKOkIyoV0-XD4n4540mgUVMbp2YD3P_4STnKvMo', '0B7FMWP-mb_mld1hQTW02dVR1VjA'], ['1FVe5hmUupy3E4QZz_SkYn5ZxE2zoyV8xrv0eQLblG78', '0B7FMWP-mb_mlWmdKT0FTZnQwVkk'], ['1z4sgjDgzJYruq6iQDfNvpnyAG81XvMqaz0nfoVlZYf0', '0B7FMWP-mb_mlbUpXUi1xN2RtSFE'], ['12CrLc-w5sUfLk3DPuMQ9i3L6l2XhuerpezkNZuiZPoc', '0B7FMWP-mb_mldDk1SFE4WDdYZEU'], ['1gTQ89gAjZ1GA9O19c-GpIcdjk_Ha8k1aCq4SEVuH2DA', '0B7FMWP-mb_mlOThISFFWczNkQzQ'], ['1NO9v-jncaK6rSHrky5tHaReyyVbjtPhUwWpzlq7fr3U', '0B7FMWP-mb_mlcFBpNlYxXzNJcTQ'], ['1rCYhFPeB44ttbXkrnw2vcNCtfHj6q1IdS_ZUAIE9wWY', '0B7FMWP-mb_mlOWtaM3FqN3JVSlk'], ['1mfvTjQ4IrzCDEfeXEyu8x7YyzNvE3I-fu4LwvULksbo', '0B7FMWP-mb_mleXBKLVQzSkstYkE'], ['1YpVt7-Q8yWp8-Za6Tiu23iVq8PHLnlOQNQOSZv6_UbQ', '0B7FMWP-mb_mlRTF0YXJ6WjRLSDQ'], ['16Ue8X4dBwcnjpIntSddKhu0GjskA3PbGqeKnjrbnCHg', '0B7FMWP-mb_mleTI1d3l5eHBQdE0'], ['1KIwGBu81t3UXi64gwMaHCqsHVjEK13XGnMVqbwLtav4', '0B7FMWP-mb_mlNGZLVE54WEhXNTg'], ['1XOlCRiZ24PEMXdZTyFkeQ7rhgHbNFXB6OfO_VSKwO_U', '0B7FMWP-mb_mlYmFmMzA1Unl1d3c'], ['1b5jsxAqhoN6suT09wG2IMTM7ijspwU6kCjSF75Rdfgg', '0B7FMWP-mb_mlSGtqeGVZYldSRWM'], ['14dpFuLZgG_qu_g-sjoRYRlADJu0GWWbMl97CUbNGKWk', '0B7FMWP-mb_mlWEZGdVlGcFZMTEk'], ['1FViJ9R_wELGfulRX5HTLk7uu3ao8Kc-dZbmp9_OLYa8', '0B7FMWP-mb_mlSjRCa3pic3Q5Zkk'], ['1MAjRV5jAd4VdaZpdKSsGVN2DESQ4-RPlt1cY7NatEtE', '0B7FMWP-mb_mlMXpDZGRlc3EtVFE'], ['1IAD8eBg0pSTLysiJb0lCx7-pj8ABixCjFeQ5LKzhiys', '0B7FMWP-mb_mlT3k0aU5kOUp0UDA'], ['1ZI6A3ew0MZoLOx5_JfVpBU7hEvClC8FcmJpKIjuD0b0', '0B7FMWP-mb_mldHBTejA0MGFlLVE'], ['13PPSBmF32zMagMESZ53RyF-yzjzMrtmx-SqF2H6uvLI', '0B7FMWP-mb_mlbWgtWnpCUmtsMzA'], ['1LKv64ifr_He87hJXjqfIzdDU0-uCw_FAwkhPTg3SEU0', '0B7FMWP-mb_mlM2dUZVdoWS1EXzg'], ['1e9_GO_XgEFiN5DxOsrM6YBqnUuiuBK5W5vSjqZ0bdus', '0B7FMWP-mb_mlMVl2QW11M2lyVk0'], ['1SYzMqgqmxq_8AwmrsfJvK9BP4_EDl53JnzCPQxBI6-8', '0B7FMWP-mb_mlZlVRUGZ2R1ljd28'], ['1PUB895tjvzyaNdy_c5F4k_69k8opwap8HKfM3wi1qME', '0B7FMWP-mb_mlVkFUUnJwRllzcGs'], ['1FvzJ_NbfIYiDonE1Bz6rD6KCgvZvCzF3NBaKFF-cupA', '0B7FMWP-mb_mla1hwdWhBaTFzclU'], ['1pc1S7_XqOsgG-MHLA5jLJIOwfkogtCGuEaDeBHpI92c', '0B7FMWP-mb_mlTE9qUXBlWDhJM2M'], ['1ZwlD2iZV0fY62AVBJUuAN6r73mQpQnV2NdC8fpzfRWw', '0B7FMWP-mb_mlbXJzRmZRd09yQkU'], ['1IAZ79HySj2R1MK5vvjoyxc3qbNVmhRgS9ANA3bul8n0', '0B7FMWP-mb_mlZUZlemFPbTRhTlU'], ['1TCCNTXNKnGEZuzA-vJi4mJchvcH6Dq93IGhprXSHue8', '0B7FMWP-mb_mlcUZxdTVJT0p2T0E'], ['1oEWxnPFW7f607N7QOUJGHzemKlUWFHboSVgxCPIOd_U', '0B7FMWP-mb_mlZWhUck1kVVExYW8'], ['1ubILX2jlXXIAciaIioXUFkoIzrtLyBtKfShjnHUmf_Q', '0B7FMWP-mb_mlWFhVNDFSU1pjQzA'], ['1pMLSt_oZNXoLJmfbNk7KckScuthQ5NsvMjUPHQKCReg', '0B7FMWP-mb_mlUzYweXBUSTZTTlE'], ['1q3uXwNFeqfnPuSnyFLV3ijdoRg5hNkCwIAYcVX8N0t0', '0B7FMWP-mb_mlcjV2eDBtNnpUSkU'], ['1vyi1dB4bwrAGRCjE59VTbJY78u5MXfvnsNnQG4D6f7c', '0B7FMWP-mb_mlb0djNThBMUJsclE'], ['117clVi6WNqLlGkfjdoGI6rRd1s60OEg55Eo8TMIqk-E', '0B7FMWP-mb_mlZFhmV2ZHYUxNU3c'], ['1B8eUQbFHSuYWnulS_Dl2Cbc7vW6EpoWNGVRdn5a_ky4', '0B7FMWP-mb_mlVDFNUmY4QWJWZGc'], ['19g0fYkoxdw-8JzQSFzlRM5KR5c0KfgIWM_7pzt-yJ6k', '0B7FMWP-mb_mlbml5c3RVdUdjSTQ'], ['18PLdfL537sQrsKAQX_nH_dllrTSiAYsAy--aUdQuQXU', '0B7FMWP-mb_mlNU9zUldHQUZHVjQ'], ['1lZbYO0bdhC7Y1p3WZ2XQBq1cgINX7dsCnKOEAvRpqzI', '0B7FMWP-mb_mlel9JbHJ1TVV6VTA'], ['1PwaAr_3YmIIRdFKt0FFzSKeXRdVXzo0kNubvJl24LzU', '0B7FMWP-mb_mlX1RYOGRSMS1kMzg'], ['1eo215DcAlrfTmnzyAGuTPVa1OpOyug3rJQRhVkYSM7I', '0B7FMWP-mb_mlNGhRa3ZONmlyRkk'], ['19rywOXDZwEMwCpzTMUtep9yU-gAcXo8h5fntX17iE64', '0B7FMWP-mb_mlQ0luYWlmTDNiT2c'], ['149kMPezdqt1qRafPJ3brBbJHZpt8YPIPjnZRUui0ivg', '0B7FMWP-mb_mlVjcydUlZRUltejA'], ['144XPBA7x9AZPLrqRIio7C2kldD-C0z8ry9GL7tL9agg', '0B7FMWP-mb_mleS1Vc2N3QnlIUEE'], ['14gXEyKw_tCtS5JQSU2EWrT6GpZTwiU3rJ6LKNrDmk8U', '0B7FMWP-mb_mlZW81SUJ0dEVwUmM'], ['15DuFSrnj7mWTeujKUP3VhFXcWEs-SVnjRP9bUqqipN0', '0B7FMWP-mb_mlZ3VlSWZhQ2gwZWc'], ['1DQlys-uFcMR8zUUHi6HgCXrGm-2pdXLUydSM-ek8w-o', '0B7FMWP-mb_mlckpfdWwyUUt4djg'], ['1uGosvyN9Npu10_9JbfzvMZUpIZ8SNT1STcyTTiB9pnc', '0B7FMWP-mb_mlQnk4ei1JT1lFWUk'], ['1XYfEmd4hoDEL1br7lit3z8MG8h3EUNzovet6biDxMJ8', '0B7FMWP-mb_mld0tIUXdXanZIRjQ'], ['1ZfeQ03TY01Qdw6Kwxcht0urAzoZdPXi5rnacpK5mo74', '0B7FMWP-mb_mlY1V3V2JlRFUzSlk'], ['1gns0gkqr6UT4udOaHUss2vgSCwsTqh-vDrlZCBGHQ54', '0B7FMWP-mb_mlUmRyVmpMTXVkSFU'], ['1nDb75e0e664iIs_Ci153imd692j1Cgtxlzsfn0Wh6Nc', '0B7FMWP-mb_mlaEx3aDlTeWc1dGs'], ['1R5K1i6cZZKEyJPpU1IlJ5i8Wk4G2MCJJo09Ws8yJnlg', '0B7FMWP-mb_mlRU9jX3o0alBCb0E'], ['1UIfgBjWtVAj7gRX-imdWf7YrboxyZmaIIix6UTj9owE', '0B7FMWP-mb_mleDZvd01rQXdnbG8'], ['1K8Qj3zyg4Tu_Q7HAKn27xw5gmWTYCZ091eT1TE6vFds', '0B7FMWP-mb_mld3ZBaGNram5sckE'], ['1mO_go7TMPjoGxwjAM0ZKfUF2nesgu-dip3zkwooZ7h0', '0B7FMWP-mb_mlYlBlazE0NWk2SUk'], ['1yAJTWS9D0JRsPW4J5hPJ1_uVMQCfFtEKq_H62QKH4ts', '0B7FMWP-mb_mlVjNEUENNbEF4dUE'], ['189GAijPb_v0YvnFor6IGDAnDCnbu_6S9uH_E4WUOpqU', '0B7FMWP-mb_mlZ200bUo1amFtckU'], ['1y2HOf8yiUydYvd6nNlXjMkydfh_GFcl6k-crEAxEhxg', '0B7FMWP-mb_mlWkFRcTZMMXRXVTQ'], ['1g8bYDbfGJgSROxu4mfd7J99ZYpP6BhH9DAemEW1-lrY', '0B7FMWP-mb_mlaUdZTktQQW0yZDg'], ['1pyroLSCGs2b36rgEizgMsw5f5XnWpQ8sZIg_noxTmV8', '0B7FMWP-mb_mldEtQWGJaTkE0OFE'], ['1T9RPi4aAzpN_TiFM12dwihbiiypYRPonG7KNPoY4Fvs', '0B7FMWP-mb_mlWTYwZ0FQM0s1emc'], ['1oLkrEzeHpk3HJbYdj2_lAOgN06560yR9T62yIrG-a4U', '0B7FMWP-mb_mlbUNLdTNhLWZaeWs'], ['1_249yh7zfM3tYQYauDvn9zTWtDW7YcmvtGyfbXdFiTs', '0B7FMWP-mb_mlbW5VclVnV2lVT1E'], ['1azKexVorpMyd3gaJNKVBlH0RMEUYqtG-Tds9JfwKP2I', '0B7FMWP-mb_mlNHRpcEJndEFGT1k'], ['1LQ3Fu5KHephc183UzJpimw6Xah55t42eFZH5PLC-ybo', '0B7FMWP-mb_mlbjBRTlhOQ0pDbW8'], ['1GbGtRAJQ9-2ak6QMkxONuonK6Qb1lNkLOPmS-DRkwDs', '0B7FMWP-mb_mla2MzeGxTa3gtc0E'], ['1uL_-q-chdJ-Rjq8hgPcEYetWmo8zyS1VL-h75EmBevc', '0B7FMWP-mb_mlcGRXdTV5Y0VOV0k'], ['1YpMN3joMY3FmCoTsj6Rn3vdNywM0sv5QEI8Or7pEcPI', '0B7FMWP-mb_mlLVF1eXBnWDVVSVE'], ['1gf7gh_q51c6FXOkXK1WVf1YwgAScDGlvA-lWKbuPMWo', '0B7FMWP-mb_mlbnR3MlpsRHFhajg'], ['1I61ntx9-rWOOAoGYv7vBTSQ_B8Jc5Qm-eOgfAjdFmfk', '0B7FMWP-mb_mlWkhDcVFNOTVma0U'], ['1ekEPJyp4aFMTZyl8FI2KmGp0Bszg-Y_M_gINciqlNuc', '0B7FMWP-mb_mlTWZzXzh5dGttd1E'], ['1a66PhymFULWYYv4v2Q0hnYDlRokLis9tZu4AbeQ6eRk', '0B7FMWP-mb_mlM185ZjZYMHpGUmc'], ['1LlDM9Bms4neNtdEqG9u-vn4cGm4KfTzpewjFYixK6Bo', '0B7FMWP-mb_mlQi1OdHVaWnBKNVk'], ['1nu1MgHSMDkA2E8PQhKTZkbDCfQ-cWeBew9-VjEos96w', '0B7FMWP-mb_mlWDFialRvX2gxV0U'], ['1LITO6_z4sLs-9jdcl6TVxH_c1sOVg7hLmAMQOIT7HF0', '0B7FMWP-mb_mlTzRtVWVJVVFuclU'], ['1x_RMmfivlPzSPjH1VRoRlPgN_yAHq6yv1fff54cmy0o', '0B7FMWP-mb_mlVTdDakw4WlVlNHc']];

function listFiles(auth) {
  var service = google.drive('v3');
  service.files.list({
    auth: auth,
    pageSize: 1000,
    fields: "nextPageToken, files(id, name, mimeType), kind"
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    var files = response.files;
    var data = {};
    if (files.length == 0) {
      console.log('No files found.');
    } else {
      console.log('Files:');
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        console.log('%s\t%s\t%s', file.mimeType, file.name, file.id);
        // data[file.id] = file;
      }
    }
    // for (var i = 0; i < pairs.length; i++) {
    //   var pair = pairs[i];
    //   console.log('%s\t%s\t%s\t%s', pair[0], data[pair[0]].name, pair[1], data[pair[1]].name);
    // }
  });
}

function sendEmail(auth) {
    var service = google.gmail('v1');
    service.users.messages.send({
        auth: auth,
        userId: 'me',
        'resource': {
          'raw': createEmail(emailAddress)
        }
    });
}

function createEmail(emailAddress) {
  // Base64-encode the mail and make it URL-safe
  // (replace all "+" with "-" and all "/" with "_")
  return new Buffer(
        "Content-Type: text/plain; charset=\"UTF-8\"\n" +
        "MIME-Version: 1.0\n" +
        "Content-Transfer-Encoding: 7bit\n" +
        "to: " + emailAddress + "\n" +
        "from: saltfatacidheat.com\n" +
        "subject: Subject Text\n\n" +

        "The actual message text goes here"
  ).toString("base64").replace(/\+/g, '-').replace(/\//g, '_');
}

function generateLinksForFiles(auth) {
  // var service = google.drive('v3');
  // service.files.list({
  //   auth: auth,
  //   pageSize: 1000,
  //   fields: "nextPageToken, files(id, name)"
  // }, function(err, response) {
  //   if (err) {
  //     console.log('The API returned an error: ' + err);
  //     return;
  //   }
  //   var files = response.files;
  //   if (files.length == 0) {
  //     console.log('No files found.');
  //   } else {
  //     for (var i = 0; i < files.length; i++) {
  //       google.drive('v3').permissions.create({
  //         auth: auth,
  //         fileId: files[i].id,
  //         sendNotificationEmail: false,
  //         transferOwnership: false,
  //         kind: "drive#permission",
  //         id: "anyoneWithLink",
  //         type: "anyone",
  //         role: "reader",
  //         allowFileDiscovery: false
  //       });
  //     }
  //   }
  // });
  google.drive('v3').permissions.create({
    auth: auth,
    fileId: '1F2r3AHCIOX8qD-OtO4OodWe4rTGPRFL6zWjThfkpL8Y',
    sendNotificationEmail: false,
    transferOwnership: false,
    fields: 'allowFileDiscovery,id,kind,role,type',
    resource: {
      type: "anyone",
      role: "reader",
      allowFileDiscovery: false
    }
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    console.log('success', response);
  });
}
