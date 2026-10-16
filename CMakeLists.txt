cmake_minimum_required(VERSION 3.20)
project(FishermansBait2Recomp C CXX)
set(CMAKE_C_STANDARD 99)
set(CMAKE_CXX_STANDARD 17)

# Provide the separate PSXRecomp source checkout at configure time.
set(PSXRECOMP_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/psxrecomp" CACHE PATH "PSXRecomp source path")
if(NOT EXISTS "${PSXRECOMP_ROOT}/runtime/runtime.cmake")
  message(FATAL_ERROR "PSXRecomp not available: provide -DPSXRECOMP_ROOT=/absolute/path/to/psxrecomp")
endif()
include("${PSXRECOMP_ROOT}/runtime/runtime.cmake")

set(FISH_GENERATED_FULL "${CMAKE_CURRENT_SOURCE_DIR}/generated/SLUS_009.99_full.c")
set(FISH_GENERATED_DISPATCH "${CMAKE_CURRENT_SOURCE_DIR}/generated/SLUS_009.99_dispatch.c")
if(NOT EXISTS "${FISH_GENERATED_FULL}" OR NOT EXISTS "${FISH_GENERATED_DISPATCH}")
  message(FATAL_ERROR "Missing local generated C. Run psxrecomp-game --config game.toml first.")
endif()

# OpenBIOS must be provided separately for the local build.
set(FISH_OPENBIOS_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/third_party/openbios" CACHE PATH "OpenBIOS local path")
if(NOT EXISTS "${FISH_OPENBIOS_ROOT}/openbios.bin")
  message(FATAL_ERROR "OpenBIOS missing: pass -DFISH_OPENBIOS_ROOT=/absolute/path/to/openbios")
endif()

if(EMSCRIPTEN)
  set(FISH_CONFIG "/game.toml")
else()
  set(FISH_CONFIG "game.toml")
endif()

psxrecomp_add_runtime_target(psx-runtime
  BIOS_INTERPRETER
  GAME_GENERATED_FULL_C "${FISH_GENERATED_FULL}"
  GAME_GENERATED_DISPATCH_C "${FISH_GENERATED_DISPATCH}"
  DEBUG_PORT 4482
  WINDOW_TITLE "Fishermans Bait 2 - Recompiled"
  DEFAULT_BIOS_PATH "${FISH_OPENBIOS_ROOT}/openbios.bin"
  DEFAULT_GAME_CONFIG_PATH "${FISH_CONFIG}"
)

if(EMSCRIPTEN)
  set_target_properties(psx-runtime PROPERTIES SUFFIX ".html")
  target_link_options(psx-runtime PRIVATE
    "-sINVOKE_RUN=0"
    "-sEXPORTED_RUNTIME_METHODS=FS,callMain"
  )
endif()
