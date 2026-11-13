# Research — 列車を順に出荷した想定の測定（全文）

Sequential what-if: T24-R1 -> T25-R2a -> T26-R1, each measured against the catalog that includes the earlier trains. canonical* = letter changes over every prefix of the canonical ladder order; addendum = earlier-train recipes re-lettered by a later train (deterministic bound, direction read from researchCohortLetters); sampledAddendum = what the 40-order sampled audit observed.

要約と表は `docs/reports/TETO_T24-T26_OwnerDecisions-Followup_2026-11-10.md` §4。Markdown に収めているのは、この PR を CI の docs-only 分類に保つため。

## onMain_7a217c38

```json
{
 "baseline": {
  "recipes": 102,
  "ingredients": 117,
  "steps": 87
 },
 "order": {
  "ordNew": [
   "aji-amarillo",
   "peanut-sauce",
   "squid",
   "spicy-salami",
   "chutney",
   "cucumber",
   "peking-duck",
   "sweet-bean-sauce",
   "cauliflower",
   "chicken-tikka",
   "nduja"
  ],
  "lateNew": [
   "kebab-sauce",
   "yogurt-sauce",
   "daikon",
   "liver-pate",
   "lime",
   "asparagus"
  ]
 },
 "stages": [
  {
   "train": "T24-R1",
   "baseRecipes": 102,
   "added": 6,
   "canonicalShipped": [],
   "canonicalEarlierTrain": [],
   "sampledCanonical": [],
   "violations": [],
   "sampledAddendum": [],
   "nonCanonicalShipped": 43,
   "addendum": []
  },
  {
   "train": "T25-R2",
   "baseRecipes": 108,
   "added": 7,
   "canonicalShipped": [],
   "canonicalEarlierTrain": [],
   "sampledCanonical": [],
   "violations": [],
   "sampledAddendum": [
    "peking-duck-pizza -->B",
    "thai-chicken-pizza -->A",
    "thai-chicken-pizza -->B"
   ],
   "nonCanonicalShipped": 59,
   "addendum": [
    {
     "recipeId": "peking-duck-pizza",
     "kind": "SHIFT",
     "maxShift": 1,
     "byMaterial": [
      {
       "material": "cucumber",
       "shift": 1
      }
     ],
     "causes": [
      {
       "newRecipeId": "pizza-salad",
       "materials": [
        "cucumber"
       ],
       "newSortsFirst": true
      }
     ]
    },
    {
     "recipeId": "south-african-boerewors",
     "kind": "NEW_LABEL_ONLY",
     "maxShift": 0,
     "byMaterial": [
      {
       "material": "onion",
       "shift": 0
      }
     ],
     "causes": [
      {
       "newRecipeId": "chicken-tikka-pizza",
       "materials": [
        "onion"
       ],
       "newSortsFirst": false
      }
     ]
    },
    {
     "recipeId": "thai-chicken-pizza",
     "kind": "SHIFT",
     "maxShift": 1,
     "byMaterial": [
      {
       "material": "cilantro",
       "shift": 1
      }
     ],
     "causes": [
      {
       "newRecipeId": "banh-mi-pizza",
       "materials": [
        "cilantro"
       ],
       "newSortsFirst": true
      },
      {
       "newRecipeId": "chicken-tikka-pizza",
       "materials": [
        "cilantro"
       ],
       "newSortsFirst": false
      }
     ]
    }
   ]
  },
  {
   "train": "T26-R1",
   "baseRecipes": 115,
   "added": 2,
   "canonicalShipped": [],
   "canonicalEarlierTrain": [],
   "sampledCanonical": [],
   "violations": [],
   "sampledAddendum": [
    "peruvian-aji-amarillo -->B",
    "thai-chicken-pizza -->B"
   ],
   "nonCanonicalShipped": 9,
   "addendum": [
    {
     "recipeId": "peruvian-aji-amarillo",
     "kind": "SHIFT",
     "maxShift": 1,
     "byMaterial": [
      {
       "material": "chicken",
       "shift": 1
      }
     ],
     "causes": [
      {
       "newRecipeId": "nashville-hot-chicken-pizza",
       "materials": [
        "chicken"
       ],
       "newSortsFirst": true
      }
     ]
    },
    {
     "recipeId": "thai-chicken-pizza",
     "kind": "SHIFT",
     "maxShift": 1,
     "byMaterial": [
      {
       "material": "chicken",
       "shift": 1
      }
     ],
     "causes": [
      {
       "newRecipeId": "nashville-hot-chicken-pizza",
       "materials": [
        "chicken"
       ],
       "newSortsFirst": true
      }
     ]
    }
   ]
  }
 ],
 "nduja": {
  "usedBy": [
   "nduja-pizza"
  ],
  "k": 2,
  "sausageK": [
   3,
   3
  ],
  "honeyK": [
   1,
   1
  ],
  "newBuildKeeps": {
   "owned": true,
   "stock": 20,
   "writes": 0
  },
  "schemaVersion": 2,
  "idTaken": false
 }
}
```

## onB23b_76db4d58

```json
{
 "baseline": {
  "recipes": 104,
  "ingredients": 122,
  "steps": 89
 },
 "order": {
  "ordNew": [
   "aji-amarillo",
   "peanut-sauce",
   "squid",
   "spicy-salami",
   "chutney",
   "cucumber",
   "peking-duck",
   "sweet-bean-sauce",
   "cauliflower",
   "chicken-tikka",
   "nduja"
  ],
  "lateNew": [
   "kebab-sauce",
   "yogurt-sauce",
   "daikon",
   "liver-pate",
   "lime",
   "asparagus"
  ]
 },
 "stages": [
  {
   "train": "T24-R1",
   "baseRecipes": 104,
   "added": 6,
   "canonicalShipped": [],
   "canonicalEarlierTrain": [],
   "sampledCanonical": [],
   "violations": [],
   "sampledAddendum": [],
   "nonCanonicalShipped": 43,
   "addendum": []
  },
  {
   "train": "T25-R2",
   "baseRecipes": 110,
   "added": 7,
   "canonicalShipped": [],
   "canonicalEarlierTrain": [],
   "sampledCanonical": [],
   "violations": [],
   "sampledAddendum": [
    "peking-duck-pizza -->B",
    "thai-chicken-pizza -->A",
    "thai-chicken-pizza -->B"
   ],
   "nonCanonicalShipped": 59,
   "addendum": [
    {
     "recipeId": "peking-duck-pizza",
     "kind": "SHIFT",
     "maxShift": 1,
     "byMaterial": [
      {
       "material": "cucumber",
       "shift": 1
      }
     ],
     "causes": [
      {
       "newRecipeId": "pizza-salad",
       "materials": [
        "cucumber"
       ],
       "newSortsFirst": true
      }
     ]
    },
    {
     "recipeId": "south-african-boerewors",
     "kind": "NEW_LABEL_ONLY",
     "maxShift": 0,
     "byMaterial": [
      {
       "material": "onion",
       "shift": 0
      }
     ],
     "causes": [
      {
       "newRecipeId": "chicken-tikka-pizza",
       "materials": [
        "onion"
       ],
       "newSortsFirst": false
      }
     ]
    },
    {
     "recipeId": "thai-chicken-pizza",
     "kind": "SHIFT",
     "maxShift": 1,
     "byMaterial": [
      {
       "material": "cilantro",
       "shift": 1
      }
     ],
     "causes": [
      {
       "newRecipeId": "banh-mi-pizza",
       "materials": [
        "cilantro"
       ],
       "newSortsFirst": true
      },
      {
       "newRecipeId": "chicken-tikka-pizza",
       "materials": [
        "cilantro"
       ],
       "newSortsFirst": false
      }
     ]
    }
   ]
  },
  {
   "train": "T26-R1",
   "baseRecipes": 117,
   "added": 2,
   "canonicalShipped": [],
   "canonicalEarlierTrain": [],
   "sampledCanonical": [],
   "violations": [],
   "sampledAddendum": [
    "peruvian-aji-amarillo -->B",
    "thai-chicken-pizza -->B"
   ],
   "nonCanonicalShipped": 9,
   "addendum": [
    {
     "recipeId": "peruvian-aji-amarillo",
     "kind": "SHIFT",
     "maxShift": 1,
     "byMaterial": [
      {
       "material": "chicken",
       "shift": 1
      }
     ],
     "causes": [
      {
       "newRecipeId": "nashville-hot-chicken-pizza",
       "materials": [
        "chicken"
       ],
       "newSortsFirst": true
      }
     ]
    },
    {
     "recipeId": "thai-chicken-pizza",
     "kind": "SHIFT",
     "maxShift": 1,
     "byMaterial": [
      {
       "material": "chicken",
       "shift": 1
      }
     ],
     "causes": [
      {
       "newRecipeId": "nashville-hot-chicken-pizza",
       "materials": [
        "chicken"
       ],
       "newSortsFirst": true
      }
     ]
    }
   ]
  }
 ],
 "nduja": {
  "usedBy": [
   "nduja-pizza"
  ],
  "k": 2,
  "sausageK": [
   3,
   3
  ],
  "honeyK": [
   1,
   1
  ],
  "newBuildKeeps": {
   "owned": true,
   "stock": 20,
   "writes": 0
  },
  "schemaVersion": 2,
  "idTaken": false
 }
}
```
