const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { isAuthenticated } = require("../middlewares/auth.middlewares");
const User = require("../models/User.model");
const Player = require("../models/Player.model");
const Team = require("../models/Team.model");

// POST "/api/team/create-team"
router.post("/create-team", isAuthenticated, async (req, res, next) => {
  const {
    teamName,
    password1,
    password2,
    portero,
    defensa,
    tecnica,
    ataque,
    cardio,
    team,
    role,
    user,
  } = req.body;

  // No fields are empty
  if (!teamName || !password1 || !password2) {
    return res
      .status(400)
      .json({ errorMessage: "Todos los campos deben estar completos" });
  }

  // Passwords match
  if (password1 !== password2) {
    return res
      .status(400)
      .json({ errorMessage: "El password ha de ser igual" });
  }

  // Password is secure
  const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{4,}$/;
  if (passwordRegex.test(password1) === false) {
    return res.status(400).json({
      errorMessage:
        "El password debe tener al menos 6 caracteres, incluir una mayuscula y un caracter especial",
    });
  }

  try {
    // team does not exist in DB
    const foundTeam = await Team.findOne({ teamName: teamName });
    if (foundTeam) {
      return res
        .status(400)
        .json({ errorMessage: "Ya existe un equipo con ese nombre" });
    }

    // Encrypt password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password1, salt);

    // Create team
    await Team.create({
      teamName,
      password: hashedPassword,
    });
    // to create player with capitan role
    const createdPlayer = await Player.create({
      portero,
      defensa,
      tecnica,
      ataque,
      cardio,
      team,
      role: "capitan",
      user: req.payload._id,
    });
    // to add the id of the new player created to user arrays of players
    await User.findByIdAndUpdate(
      req.payload._id,
      {
        $push: { players: createdPlayer._id },
      },
      { safe: true, upsert: true, new: true }
    );
  } catch (error) {
    next(error);
  }
  try {
    const foundTeam = await Team.findOne({ teamName: teamName });
    const foundPlayer = await Player.findOne({ team: null });
    await Player.findByIdAndUpdate(foundPlayer._id, {
      team: foundTeam._id,
    });
    await Team.findByIdAndUpdate(
      foundTeam._id,
      {
        $push: { players: foundPlayer._id },
      },
      { safe: true, upsert: true, new: true }
    );
    return res.status(201).json();
  } catch (error) {
    next(error);
  }
});

// POST "/api/team/join-team"
router.post("/join-team", isAuthenticated, async (req, res, next) => {
  const {
    teamName,
    password,
    portero,
    defensa,
    tecnica,
    ataque,
    cardio,
    team,
    role,
    user,
  } = req.body;

  // No fields are empty
  if (!teamName || !password) {
    return res
      .status(400)
      .json({ errorMessage: "Todos los campos deben estar completos" });
  }

  try {
    const foundTeam = await Team.findOne({ teamName: teamName });
    let playerIsPresent = false;

    // team exist in DB
    if (!foundTeam) {
      return res.status(400).json({ errorMessage: "El equipo no existe" });
    }

    // Password is correct
    const isPasswordCorrect = await bcrypt.compare(
      password,
      foundTeam.password
    );
    if (!isPasswordCorrect) {
      return res
        .status(400)
        .json({ errorMessage: "El password de acceso es incorrecto" });
    }
    //  Player is present in the team
    req.payload.players.forEach((eachUserPlayer) => {
      if (foundTeam.players.includes(eachUserPlayer)) {
        return (playerIsPresent = true);
      } else {
        return (playerIsPresent = false);
      }
    });

    console.log(playerIsPresent);
    if (!playerIsPresent) {
      //   // create player
      const createdPlayer = await Player.create({
        portero,
        defensa,
        tecnica,
        ataque,
        cardio,
        team,
        role,
        user: req.payload._id,
      });
      // to add the id of the new player created to user arrays of players
      await User.findByIdAndUpdate(
        req.payload._id,
        {
          $push: { players: createdPlayer._id },
        },
        { safe: true, upsert: true, new: true }
      );

      await Team.findByIdAndUpdate(
        foundTeam._id,
        {
          $push: { players: createdPlayer._id },
        },
        { safe: true, upsert: true, new: true }
      );

      try {
        const foundPlayer = await Player.findOne({ team: null });
        await Player.findByIdAndUpdate(foundPlayer._id, {
          team: foundTeam._id,
        });
        
        return res.status(201).json();
      } catch (error) {
        next(error);
      }

      return res.status(201).json();
    } else {
      return res.status(200).json();
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;