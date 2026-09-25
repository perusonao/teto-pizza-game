/**
 * RT-01a (docs/reports/TETO_RT01_REFERENCE-PIECE-CAPACITY_Fresh-Design.md, Owner Decision
 * RT-01-OD-1): frozen BEFORE baseline, generated from main `1e53baa` behaviour (before any
 * RT-01 runtime change), for the 15 shipped recipes. RT-01's own regression tests compare the
 * live output against these values so a 1-8 piece layout can never drift:
 *
 * - `PLAYER_REFERENCE_BASELINE`: `getPlayerReferencePizza(recipe).pieceGroups` per recipe.
 * - `PIZZA_THUMBNAIL_HTML_BASELINE`: `<PizzaThumbnail recipe={recipe} />`'s rendered markup.
 * - `SCORING_FIXTURES_FNV1A`: length + FNV-1a 32 digest of `JSON.stringify(RECIPES.map((r) =>
 *   getReferencePizza(r.id)))` -- the Scoring 2.0 fixtures RT-01 must never touch.
 *
 * Test-only data; never imported by production code. Do not regenerate to make a failing test
 * pass -- a mismatch means a shipped reference layout changed.
 */
export const PLAYER_REFERENCE_BASELINE: Record<string, readonly { ingredientId: string; positions: readonly { x: number; y: number }[] }[]> = {
  "margherita": [
    {
      "ingredientId": "mozzarella",
      "positions": [
        {
          "x": 50,
          "y": 24
        },
        {
          "x": 73,
          "y": 36
        },
        {
          "x": 76,
          "y": 63
        }
      ]
    },
    {
      "ingredientId": "basil",
      "positions": [
        {
          "x": 58,
          "y": 79
        },
        {
          "x": 38,
          "y": 79
        }
      ]
    }
  ],
  "marinara": [
    {
      "ingredientId": "garlic",
      "positions": [
        {
          "x": 50,
          "y": 24
        },
        {
          "x": 73,
          "y": 36
        },
        {
          "x": 76,
          "y": 63
        }
      ]
    },
    {
      "ingredientId": "oregano",
      "positions": [
        {
          "x": 58,
          "y": 79
        },
        {
          "x": 38,
          "y": 79
        }
      ]
    }
  ],
  "quattro-formaggi": [
    {
      "ingredientId": "mozzarella",
      "positions": [
        {
          "x": 50,
          "y": 24
        },
        {
          "x": 73,
          "y": 36
        }
      ]
    },
    {
      "ingredientId": "gorgonzola",
      "positions": [
        {
          "x": 76,
          "y": 63
        },
        {
          "x": 58,
          "y": 79
        }
      ]
    },
    {
      "ingredientId": "parmigiano",
      "positions": [
        {
          "x": 38,
          "y": 79
        },
        {
          "x": 22,
          "y": 63
        }
      ]
    },
    {
      "ingredientId": "fontina",
      "positions": [
        {
          "x": 25,
          "y": 36
        },
        {
          "x": 50,
          "y": 52
        }
      ]
    }
  ],
  "genovese": [
    {
      "ingredientId": "mozzarella",
      "positions": [
        {
          "x": 50,
          "y": 24
        },
        {
          "x": 73,
          "y": 36
        }
      ]
    },
    {
      "ingredientId": "cherry-tomato",
      "positions": [
        {
          "x": 76,
          "y": 63
        },
        {
          "x": 58,
          "y": 79
        },
        {
          "x": 38,
          "y": 79
        }
      ]
    }
  ],
  "bismarck": [
    {
      "ingredientId": "mozzarella",
      "positions": [
        {
          "x": 50,
          "y": 24
        },
        {
          "x": 73,
          "y": 36
        },
        {
          "x": 76,
          "y": 63
        }
      ]
    },
    {
      "ingredientId": "egg",
      "positions": [
        {
          "x": 58,
          "y": 79
        }
      ]
    }
  ],
  "funghi": [
    {
      "ingredientId": "mozzarella",
      "positions": [
        {
          "x": 50,
          "y": 24
        },
        {
          "x": 73,
          "y": 36
        }
      ]
    },
    {
      "ingredientId": "mushroom",
      "positions": [
        {
          "x": 76,
          "y": 63
        },
        {
          "x": 58,
          "y": 79
        },
        {
          "x": 38,
          "y": 79
        }
      ]
    }
  ],
  "fugazza": [
    {
      "ingredientId": "onion",
      "positions": [
        {
          "x": 50,
          "y": 24
        },
        {
          "x": 73,
          "y": 36
        },
        {
          "x": 76,
          "y": 63
        },
        {
          "x": 58,
          "y": 79
        }
      ]
    },
    {
      "ingredientId": "oregano",
      "positions": [
        {
          "x": 38,
          "y": 79
        }
      ]
    }
  ],
  "salsiccia": [
    {
      "ingredientId": "mozzarella",
      "positions": [
        {
          "x": 50,
          "y": 24
        },
        {
          "x": 73,
          "y": 36
        }
      ]
    },
    {
      "ingredientId": "sausage",
      "positions": [
        {
          "x": 76,
          "y": 63
        },
        {
          "x": 58,
          "y": 79
        },
        {
          "x": 38,
          "y": 79
        }
      ]
    }
  ],
  "pepperoni": [
    {
      "ingredientId": "mozzarella",
      "positions": [
        {
          "x": 50,
          "y": 24
        },
        {
          "x": 73,
          "y": 36
        }
      ]
    },
    {
      "ingredientId": "pepperoni",
      "positions": [
        {
          "x": 76,
          "y": 63
        },
        {
          "x": 58,
          "y": 79
        },
        {
          "x": 38,
          "y": 79
        },
        {
          "x": 22,
          "y": 63
        }
      ]
    }
  ],
  "napoletana": [
    {
      "ingredientId": "mozzarella",
      "positions": [
        {
          "x": 50,
          "y": 24
        },
        {
          "x": 73,
          "y": 36
        }
      ]
    },
    {
      "ingredientId": "anchovy",
      "positions": [
        {
          "x": 76,
          "y": 63
        },
        {
          "x": 58,
          "y": 79
        },
        {
          "x": 38,
          "y": 79
        }
      ]
    },
    {
      "ingredientId": "oregano",
      "positions": [
        {
          "x": 22,
          "y": 63
        }
      ]
    }
  ],
  "tonno-e-cipolla": [
    {
      "ingredientId": "mozzarella",
      "positions": [
        {
          "x": 50,
          "y": 24
        },
        {
          "x": 73,
          "y": 36
        }
      ]
    },
    {
      "ingredientId": "onion",
      "positions": [
        {
          "x": 76,
          "y": 63
        },
        {
          "x": 58,
          "y": 79
        }
      ]
    },
    {
      "ingredientId": "tuna",
      "positions": [
        {
          "x": 38,
          "y": 79
        },
        {
          "x": 22,
          "y": 63
        },
        {
          "x": 25,
          "y": 36
        }
      ]
    }
  ],
  "pizza-bianca": [
    {
      "ingredientId": "rosemary",
      "positions": [
        {
          "x": 50,
          "y": 24
        },
        {
          "x": 73,
          "y": 36
        },
        {
          "x": 76,
          "y": 63
        }
      ]
    }
  ],
  "breakfast-pizza": [
    {
      "ingredientId": "mozzarella",
      "positions": [
        {
          "x": 50,
          "y": 24
        },
        {
          "x": 73,
          "y": 36
        }
      ]
    },
    {
      "ingredientId": "egg",
      "positions": [
        {
          "x": 76,
          "y": 63
        }
      ]
    },
    {
      "ingredientId": "bacon",
      "positions": [
        {
          "x": 58,
          "y": 79
        },
        {
          "x": 38,
          "y": 79
        },
        {
          "x": 22,
          "y": 63
        }
      ]
    }
  ],
  "capricciosa": [
    {
      "ingredientId": "mozzarella",
      "positions": [
        {
          "x": 50,
          "y": 24
        },
        {
          "x": 73,
          "y": 36
        }
      ]
    },
    {
      "ingredientId": "mushroom",
      "positions": [
        {
          "x": 76,
          "y": 63
        },
        {
          "x": 58,
          "y": 79
        }
      ]
    },
    {
      "ingredientId": "oregano",
      "positions": [
        {
          "x": 38,
          "y": 79
        }
      ]
    },
    {
      "ingredientId": "ham",
      "positions": [
        {
          "x": 22,
          "y": 63
        }
      ]
    },
    {
      "ingredientId": "black-olive",
      "positions": [
        {
          "x": 25,
          "y": 36
        },
        {
          "x": 50,
          "y": 52
        }
      ]
    }
  ],
  "meat-lovers": [
    {
      "ingredientId": "mozzarella",
      "positions": [
        {
          "x": 50,
          "y": 24
        },
        {
          "x": 73,
          "y": 36
        }
      ]
    },
    {
      "ingredientId": "bacon",
      "positions": [
        {
          "x": 76,
          "y": 63
        },
        {
          "x": 58,
          "y": 79
        }
      ]
    },
    {
      "ingredientId": "ham",
      "positions": [
        {
          "x": 38,
          "y": 79
        }
      ]
    },
    {
      "ingredientId": "pepperoni",
      "positions": [
        {
          "x": 22,
          "y": 63
        }
      ]
    },
    {
      "ingredientId": "sausage",
      "positions": [
        {
          "x": 25,
          "y": 36
        },
        {
          "x": 50,
          "y": 52
        }
      ]
    }
  ]
};

export const PIZZA_THUMBNAIL_HTML_BASELINE: Record<string, string> = {
  "margherita": "<div class=\"pizza-thumbnail\" aria-hidden=\"true\"><div class=\"pizza-thumbnail__base\" style=\"background-color: rgb(199, 59, 46);\"></div><span class=\"pizza-thumbnail__piece\" style=\"left: 50%; top: 24%; --piece-rotation: -2.5075236913998427deg;\"><span class=\"pizza-cheese pizza-cheese--mozzarella\" style=\"--cheese-color: #fdf6e3;\"></span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 73%; top: 36%; --piece-rotation: -12.746617302938043deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🌿</span></span></div>",
  "marinara": "<div class=\"pizza-thumbnail\" aria-hidden=\"true\"><div class=\"pizza-thumbnail__base\" style=\"background-color: rgb(199, 59, 46);\"></div><span class=\"pizza-thumbnail__piece\" style=\"left: 50%; top: 24%; --piece-rotation: -7.241406727871254deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🧄</span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 73%; top: 36%; --piece-rotation: 10.707363971673734deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🍃</span></span></div>",
  "quattro-formaggi": "<div class=\"pizza-thumbnail\" aria-hidden=\"true\"><div class=\"pizza-thumbnail__base\" style=\"background-color: rgb(233, 217, 160);\"></div><span class=\"pizza-thumbnail__piece\" style=\"left: 50%; top: 24%; --piece-rotation: -2.5075236913998427deg;\"><span class=\"pizza-cheese pizza-cheese--mozzarella\" style=\"--cheese-color: #fdf6e3;\"></span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 73%; top: 36%; --piece-rotation: -0.8549933067650983deg;\"><span class=\"pizza-cheese pizza-cheese--gorgonzola\" style=\"--cheese-color: #e8e0c8;\"></span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 76%; top: 63%; --piece-rotation: -6.593976358090056deg;\"><span class=\"pizza-cheese pizza-cheese--parmigiano\" style=\"--cheese-color: #f6e6a8;\"></span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 58%; top: 79%; --piece-rotation: -10.579493347690324deg;\"><span class=\"pizza-cheese pizza-cheese--fontina\" style=\"--cheese-color: #f0d9a0;\"></span></span></div>",
  "genovese": "<div class=\"pizza-thumbnail\" aria-hidden=\"true\"><div class=\"pizza-thumbnail__base\" style=\"background-color: rgb(107, 142, 61);\"></div><span class=\"pizza-thumbnail__piece\" style=\"left: 50%; top: 24%; --piece-rotation: -2.5075236913998427deg;\"><span class=\"pizza-cheese pizza-cheese--mozzarella\" style=\"--cheese-color: #fdf6e3;\"></span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 73%; top: 36%; --piece-rotation: -13.205641161465469deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🍅</span></span></div>",
  "bismarck": "<div class=\"pizza-thumbnail\" aria-hidden=\"true\"><div class=\"pizza-thumbnail__base\" style=\"background-color: rgb(199, 59, 46);\"></div><span class=\"pizza-thumbnail__piece\" style=\"left: 50%; top: 24%; --piece-rotation: -2.5075236913998427deg;\"><span class=\"pizza-cheese pizza-cheese--mozzarella\" style=\"--cheese-color: #fdf6e3;\"></span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 73%; top: 36%; --piece-rotation: -7.570424651161401deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🥚</span></span></div>",
  "funghi": "<div class=\"pizza-thumbnail\" aria-hidden=\"true\"><div class=\"pizza-thumbnail__base\" style=\"background-color: rgb(199, 59, 46);\"></div><span class=\"pizza-thumbnail__piece\" style=\"left: 50%; top: 24%; --piece-rotation: -2.5075236913998427deg;\"><span class=\"pizza-cheese pizza-cheese--mozzarella\" style=\"--cheese-color: #fdf6e3;\"></span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 73%; top: 36%; --piece-rotation: -11.798339193174229deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🍄</span></span></div>",
  "fugazza": "<div class=\"pizza-thumbnail\" aria-hidden=\"true\"><div class=\"pizza-thumbnail__base\" style=\"background-color: rgb(233, 217, 160);\"></div><span class=\"pizza-thumbnail__piece\" style=\"left: 50%; top: 24%; --piece-rotation: 8.920422895560138deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🧅</span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 73%; top: 36%; --piece-rotation: 10.707363971673734deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🍃</span></span></div>",
  "salsiccia": "<div class=\"pizza-thumbnail\" aria-hidden=\"true\"><div class=\"pizza-thumbnail__base\" style=\"background-color: rgb(199, 59, 46);\"></div><span class=\"pizza-thumbnail__piece\" style=\"left: 50%; top: 24%; --piece-rotation: -2.5075236913998427deg;\"><span class=\"pizza-cheese pizza-cheese--mozzarella\" style=\"--cheese-color: #fdf6e3;\"></span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 73%; top: 36%; --piece-rotation: -0.9297206343453659deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🌭</span></span></div>",
  "pepperoni": "<div class=\"pizza-thumbnail\" aria-hidden=\"true\"><div class=\"pizza-thumbnail__base\" style=\"background-color: rgb(199, 59, 46);\"></div><span class=\"pizza-thumbnail__piece\" style=\"left: 50%; top: 24%; --piece-rotation: -2.5075236913998427deg;\"><span class=\"pizza-cheese pizza-cheese--mozzarella\" style=\"--cheese-color: #fdf6e3;\"></span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 73%; top: 36%; --piece-rotation: -2.3765998511520685deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🔴</span></span></div>",
  "napoletana": "<div class=\"pizza-thumbnail\" aria-hidden=\"true\"><div class=\"pizza-thumbnail__base\" style=\"background-color: rgb(199, 59, 46);\"></div><span class=\"pizza-thumbnail__piece\" style=\"left: 50%; top: 24%; --piece-rotation: -2.5075236913998427deg;\"><span class=\"pizza-cheese pizza-cheese--mozzarella\" style=\"--cheese-color: #fdf6e3;\"></span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 73%; top: 36%; --piece-rotation: -7.212638780757001deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🐟</span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 76%; top: 63%; --piece-rotation: 10.218366455337584deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🍃</span></span></div>",
  "tonno-e-cipolla": "<div class=\"pizza-thumbnail\" aria-hidden=\"true\"><div class=\"pizza-thumbnail__base\" style=\"background-color: rgb(199, 59, 46);\"></div><span class=\"pizza-thumbnail__piece\" style=\"left: 50%; top: 24%; --piece-rotation: -2.5075236913998427deg;\"><span class=\"pizza-cheese pizza-cheese--mozzarella\" style=\"--cheese-color: #fdf6e3;\"></span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 73%; top: 36%; --piece-rotation: -8.759053220683487deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🧅</span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 76%; top: 63%; --piece-rotation: -8.464642263591438deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🐠</span></span></div>",
  "pizza-bianca": "<div class=\"pizza-thumbnail\" aria-hidden=\"true\"><div class=\"pizza-thumbnail__base\" style=\"background-color: rgb(233, 217, 160);\"></div><span class=\"pizza-thumbnail__piece\" style=\"left: 50%; top: 24%; --piece-rotation: -12.53304464335857deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🌱</span></span></div>",
  "breakfast-pizza": "<div class=\"pizza-thumbnail\" aria-hidden=\"true\"><div class=\"pizza-thumbnail__base\" style=\"background-color: rgb(199, 59, 46);\"></div><span class=\"pizza-thumbnail__piece\" style=\"left: 50%; top: 24%; --piece-rotation: -2.5075236913998427deg;\"><span class=\"pizza-cheese pizza-cheese--mozzarella\" style=\"--cheese-color: #fdf6e3;\"></span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 73%; top: 36%; --piece-rotation: -7.570424651161401deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🥚</span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 76%; top: 63%; --piece-rotation: 2.858133977478866deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🥓</span></span></div>",
  "capricciosa": "<div class=\"pizza-thumbnail\" aria-hidden=\"true\"><div class=\"pizza-thumbnail__base\" style=\"background-color: rgb(199, 59, 46);\"></div><span class=\"pizza-thumbnail__piece\" style=\"left: 50%; top: 24%; --piece-rotation: -2.5075236913998427deg;\"><span class=\"pizza-cheese pizza-cheese--mozzarella\" style=\"--cheese-color: #fdf6e3;\"></span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 73%; top: 36%; --piece-rotation: -11.798339193174229deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🍄</span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 76%; top: 63%; --piece-rotation: 10.218366455337584deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🍃</span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 58%; top: 79%; --piece-rotation: 5.437361328731608deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🍖</span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 38%; top: 79%; --piece-rotation: -10.466716507558411deg;\"><span class=\"pizza-thumbnail__piece-emoji\">⚫</span></span></div>",
  "meat-lovers": "<div class=\"pizza-thumbnail\" aria-hidden=\"true\"><div class=\"pizza-thumbnail__base\" style=\"background-color: rgb(199, 59, 46);\"></div><span class=\"pizza-thumbnail__piece\" style=\"left: 50%; top: 24%; --piece-rotation: -2.5075236913998427deg;\"><span class=\"pizza-cheese pizza-cheese--mozzarella\" style=\"--cheese-color: #fdf6e3;\"></span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 73%; top: 36%; --piece-rotation: 10.686157894480544deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🥓</span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 76%; top: 63%; --piece-rotation: 5.210750413874804deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🍖</span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 58%; top: 79%; --piece-rotation: -0.39959909077724487deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🔴</span></span><span class=\"pizza-thumbnail__piece\" style=\"left: 38%; top: 79%; --piece-rotation: -6.8138764791222926deg;\"><span class=\"pizza-thumbnail__piece-emoji\">🌭</span></span></div>"
};

/** FNV-1a 32-bit over UTF-16 code units (hex) -- dependency-free, so the app tsconfig needs no
 *  Node types. Only used to detect any change to the frozen fixture JSON. */
export function fnv1a32(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export const SCORING_FIXTURES_FNV1A = { length: 12175, fnv1a: "d8d71484" };
